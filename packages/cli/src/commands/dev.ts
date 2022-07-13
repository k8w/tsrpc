import chalk from "chalk";
import { ChildProcess, spawn } from "child_process";
import chokidar from "chokidar";
import { Stats } from "fs";
import fse from "fs-extra";
import { glob } from "glob";
import path from "path";
import { CodeTemplate } from "..";
import { i18n } from "../i18n/i18n";
import { ProtoUtil } from "../models/ProtoUtil";
import { MsgTemplate, PtlTemplate, TsrpcConfig } from "../models/TsrpcConfig";
import { genNewApiFile } from "./api";
import { copyDirReadonly, syncByConfig } from "./sync";

const DEFAULT_DELAY = 1000;

export interface CmdDevOptions {
    config: TsrpcConfig,
    entry: string | undefined
}

export async function cmdDev(options: CmdDevOptions) {
    let conf = options.config;

    const autoProto = conf.dev?.autoProto ?? true;
    const autoSync = conf.dev?.autoSync ?? true;
    const autoApi = conf.dev?.autoApi ?? true;
    const entry = options.entry ?? conf.dev?.entry ?? 'src/index.ts';
    const devServerArgs = ['-r', 'ts-node/register', ...(conf.dev?.nodeArgs ?? []), entry];
    const cmdStart = 'node ' + devServerArgs.map(v => /\s/.test(v) ? `'${v}'` : v).join(' ');
    const watchFiles = conf.dev?.watch ?? 'src';
    let protoErr: { [protoPath: string]: string } = {};

    // 启动前 sync 一次
    if (conf.sync && autoSync) {
        await syncByConfig(conf.sync, conf.verbose ? console : undefined)
    }

    // Auto Copy if target is a file (maybe a link)
    let firstSyncedIndices: number[] = [];
    if (conf.sync) {
        let copyConfs = conf.sync.filter(v => v.type === 'copy');
        for (let i = 0; i < copyConfs.length; ++i) {
            let conf = copyConfs[i];
            let lstat = await fse.lstat(conf.to);
            if (lstat.isSymbolicLink() || lstat.isFile()) {
                await fse.remove(conf.to);
                await copyDirReadonly(conf.from, conf.to, !!conf.clean, conf.readonly ?? true, options.config.verbose ? console : undefined);
                console.log(chalk.green(`✔ ${i18n.copy} '${conf.from}' -> '${conf.to}'`));
                firstSyncedIndices.push(i);
            }
        }
    }

    // Auto Proto
    if (autoProto && conf.proto) {
        for (let confItem of conf.proto) {
            const protoPath = path.resolve(confItem.output);

            // 启动前执行一次填充
            await fillAllPtlAndMsgs(confItem, autoApi)

            // old
            let old = await ProtoUtil.loadOldProtoByConfigItem(confItem, options.config.verbose);

            const onAutoProtoTrigger = async () => {
                let newProto = await ProtoUtil.genProtoByConfigItem(confItem, old, options.config.verbose, options.config.checkOptimizableProto, true).catch(e => {
                    // 插入错误记录
                    protoErr[protoPath] = e.message;
                    console.error(chalk.red(e.message));
                    return undefined;
                });

                // 生成成功，清除错误记录
                if (newProto) {
                    delete protoErr[protoPath];
                }
            }

            delayWatch({
                matches: confItem.watch ?? watchFiles,
                ignore: [confItem.output, ...(confItem.compatible ? [confItem.compatible] : []), ...(confItem.ignore ?? [])],
                onChange: async (eventName, filepath, stats) => {
                    // 该文件不是 Msg 或 Ptl，跳过
                    let match = path.basename(filepath).match(/^(Ptl|Msg)(\w+)\.ts$/);
                    if (!match) {
                        return;
                    }

                    // 该文件不在 ptlDir 下，跳过
                    if (path.relative(confItem.ptlDir, filepath).startsWith('..')) {
                        return;
                    }

                    let type = match[1] as 'Ptl' | 'Msg';
                    let basename = match[2];

                    // Auto fill new Ptl or Msg
                    if ((conf.dev?.autoFillNewPtl ?? true) && eventName === 'add') {
                        await fillNewPtlOrMsg(filepath, confItem, { type, basename });
                    }

                    // Auto Api
                    if (autoApi && confItem.apiDir && type === 'Ptl') {
                        let apiFilePath = path.join(confItem.apiDir, path.relative(confItem.ptlDir, path.join(path.dirname(filepath), `Api${basename}.ts`)));
                        let emptyApiContent = (confItem.apiTemplate ?? CodeTemplate.defaultApi)(basename, path.dirname(apiFilePath), path.dirname(filepath));

                        // Auto generate new API
                        if (eventName === 'add') {
                            await genNewApiFile(basename, apiFilePath, path.dirname(apiFilePath), path.dirname(filepath), confItem.apiTemplate ?? CodeTemplate.defaultApi).catch();
                        }

                        // Auto remove unchanged API
                        if (eventName === 'unlink') {
                            // File not exists
                            if (await fse.access(apiFilePath).catch(() => true)) {
                                return;
                            }

                            // Compare, only remove when it is unchanged
                            let apiContent = await fse.readFile(apiFilePath, 'utf-8').catch(() => undefined);
                            if (apiContent?.length === 0 || apiContent === emptyApiContent) {
                                await fse.remove(apiFilePath).catch();
                            }
                        }
                    }
                },
                onTrigger: onAutoProtoTrigger,
                delay: conf.dev?.delay ?? DEFAULT_DELAY,
                watchId: `AutoProto_${conf.proto.indexOf(confItem)}`,
            });
            await onAutoProtoTrigger();
        }
    }

    // Auto Copy
    if (autoSync) {
        conf.sync?.forEach((confItem, idx) => {
            if (confItem.type !== 'copy') {
                return;
            }

            let isInited = firstSyncedIndices.indexOf(idx) > -1;

            delayWatch({
                matches: confItem.from,
                onTrigger: async (eventName: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', filepath: string, stats?: Stats) => {
                    // 仅第一次全量
                    if (!isInited) {
                        await copyDirReadonly(confItem.from, confItem.to, !!confItem.clean, confItem.readonly ?? true, options.config.verbose ? console : undefined);
                        console.log(chalk.green(`✔ ${i18n.copy} '${confItem.from}' -> '${confItem.to}'`));
                        isInited = true;
                    }
                    // 后续改为增量
                    else {
                        const dstPath = path.resolve(confItem.to, path.relative(confItem.from, filepath));
                        // 删除
                        if (eventName.startsWith('unlink')) {
                            await fse.remove(dstPath)
                        }
                        // 重新复制
                        else {
                            await fse.copy(filepath, dstPath);
                            if (!eventName.endsWith('Dir')) {
                                await fse.chmod(dstPath, 0o444);
                            }
                            console.log(chalk.green(`✔ ${i18n.copy} '${filepath}' -> '${dstPath}'`));
                        }
                    }
                },
                delay: conf.dev?.delay ?? DEFAULT_DELAY,
                watchId: `AutoSync_${idx}`,

            })
        })
    }

    // dev server
    let devServer: ChildProcess | undefined;
    let devServerRestartTimes = 0;
    const startDevServer = async () => {
        let restartTimes = devServerRestartTimes;

        // 延迟一会，如果没有新的重启请求，则执行重启
        await new Promise(rs => setTimeout(rs, 200));
        if (devServerRestartTimes !== restartTimes) {
            return;
        }

        // 有 Proto 生成错误时，始终不启动 devServer
        for (let protoPath in protoErr) {
            if (protoErr[protoPath]) {
                console.error(chalk.yellow(i18n.protoNotReady + '\n'))
                return;
            }
        }

        console.log(`${chalk.green(i18n.startDevServer)} ${chalk.cyan(cmdStart)}\n`);
        devServer = spawn('node', devServerArgs, {
            stdio: 'inherit'
        });
        devServer.once('exit', () => {
            console.log(chalk.red.bold(i18n.devServerStopped));
        });
    }
    delayWatch({
        matches: watchFiles,
        onWillTrigger: async () => {
            ++devServerRestartTimes;

            if (devServer) {
                console.log(chalk.yellow(i18n.devServerRestarting))
                // 还在运行中，kill 之
                if (devServer.exitCode == null) {
                    await new Promise(rs => {
                        devServer!.removeAllListeners('exit');
                        devServer!.once('exit', rs);
                        devServer!.kill();
                    });
                }
            }
            devServer = undefined;
        },
        onTrigger: () => {
            startDevServer()
        },
        delay: conf.dev?.delay ?? DEFAULT_DELAY,
        watchId: 'DEV_SERVER',
    })
    startDevServer()
}

function delayWatch(options: {
    matches: string | string[],
    ignore?: string | string[],
    onChange?: (eventName: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', filepath: string, stats?: Stats) => void | Promise<void>,
    /** 文件已经变化，一段时间后即将触发 */
    onWillTrigger?: (eventName: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', filepath: string, stats?: Stats) => void | Promise<void>,
    /** 实际触发 */
    onTrigger?: (eventName: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', filepath: string, stats?: Stats) => void | Promise<void>,
    delay: number,
    watchId: string
}) {
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Real file change handler，禁止并发
    let isProcessing = false;
    const onWillTrigger = async (eventName: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', filepath: string, stats?: Stats) => {
        options.onChange?.(eventName, filepath, stats);

        if (isProcessing) {
            return;
        }
        isProcessing = true;

        // clear last timer
        if (timer) {
            clearTimeout(timer);
            timer = undefined;
        }
        // 只在此变化循环中，第一次变化时，触发onWillTrigger
        else {
            await options.onWillTrigger?.(eventName, filepath, stats);
        }
        // set new delay timer
        timer = setTimeout(() => {
            timer = undefined;
            options.onTrigger?.(eventName, filepath, stats)
        }, options.delay);

        isProcessing = false;
    }

    chokidar.watch(options.matches, {
        ignored: options.ignore,
        ignoreInitial: true
    }).on('all', onWillTrigger);
}

export async function fillNewPtlOrMsg(filepath: string, confItem: NonNullable<TsrpcConfig['proto']>[number], parsed?: {
    type: 'Ptl' | 'Msg',
    basename: string
}): Promise<boolean> {
    // 只写入空白文件
    let content = await fse.readFile(filepath);
    if (content.length > 0) {
        return false;
    }

    if (!parsed) {
        let match = path.basename(filepath).match(/^(Ptl|Msg)(\w+)\.ts$/);
        if (!match) {
            return false;
        }
        parsed = {
            type: match[1] as 'Ptl' | 'Msg',
            basename: match[2],
        }
    }

    if (parsed.type === 'Ptl') {
        await fse.writeFile(filepath, getPtlTemplate(confItem.ptlTemplate)(parsed.basename, filepath, confItem.ptlDir), 'utf-8');
    }
    else if (parsed.type === 'Msg') {
        await fse.writeFile(filepath, getMsgTemplate(confItem.msgTemplate)(parsed.basename, filepath, confItem.ptlDir), 'utf-8');
    }

    return true;
}

export async function fillAllPtlAndMsgs(confItem: NonNullable<TsrpcConfig['proto']>[number], autoApi: boolean = false) {
    let files = await new Promise<string[]>((rs, rj) => {
        glob(path.resolve(path.resolve(confItem.ptlDir, '**/{Ptl,Msg}?*.ts')), (err, matches) => {
            if (err) {
                rj(err)
            }
            else {
                rs(matches);
            }
        })
    });
    for (let file of files) {
        await fillNewPtlOrMsg(file, confItem);
        let match = path.basename(file).match(/^(Ptl|Msg)(\w+)\.ts$/)!;
        let type = match[1];
        let basename = match[2];

        if (autoApi && type === 'Ptl' && confItem.apiDir) {
            let apiFilePath = path.join(confItem.apiDir, path.relative(confItem.ptlDir, path.join(path.dirname(file), `Api${basename}.ts`)));
            await genNewApiFile(basename, apiFilePath, path.dirname(apiFilePath), path.dirname(file), confItem.apiTemplate ?? CodeTemplate.defaultApi).catch();
        }
    }
}

function getPtlTemplate(ptlTemplate: NonNullable<TsrpcConfig['proto']>[0]['ptlTemplate']): PtlTemplate {
    if (!ptlTemplate) {
        return CodeTemplate.defaultPtl;
    }
    if (typeof ptlTemplate === 'function') {
        return ptlTemplate;
    }
    if (ptlTemplate.baseFile) {
        return CodeTemplate.getExtendedPtl(ptlTemplate.baseFile, ptlTemplate.baseReq, ptlTemplate.baseRes, ptlTemplate.baseConf)
    }

    throw new Error(`Invalid ptlTemplate: ` + ptlTemplate);
}

function getMsgTemplate(msgTemplate: NonNullable<TsrpcConfig['proto']>[0]['msgTemplate']): MsgTemplate {
    if (!msgTemplate) {
        return CodeTemplate.defaultMsg;
    }
    if (typeof msgTemplate === 'function') {
        return msgTemplate;
    }
    if (msgTemplate.baseFile) {
        return CodeTemplate.getExtendedMsg(msgTemplate.baseFile, msgTemplate.baseMsg, msgTemplate.baseConf)
    }

    throw new Error(`Invalid msgTemplate: ` + msgTemplate);
}