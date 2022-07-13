import chalk from "chalk";
import fs from "fs-extra";
import glob from "glob";
import path from "path";
import { EncodeIdUtil, ProtoGeneratorOptions, TSBufferProtoGenerator } from "tsbuffer-proto-generator";
import { TSBufferProto } from "tsbuffer-schema";
import { Logger, ServiceDef, ServiceProto } from "tsrpc-proto";
import { i18n } from "../i18n/i18n";
import { importTS } from './importTS';
import { TsrpcConfig } from "./TsrpcConfig";
import { error, formatStr } from "./util";

export class ProtoUtil {

    static async loadServiceProto(filepath: string, logger?: Logger, useRegExpWhenTsError: boolean = true): Promise<ServiceProto<any> | undefined> {
        if (await fs.access(filepath).catch(e => true)) {
            logger?.error(formatStr(i18n.fileNotExists, { file: path.resolve(filepath) }))
            return undefined;
        }

        if (filepath.endsWith('.ts')) {
            // 首先尝试通过 ts-node 直接解析
            let module: { [key: string]: any } | undefined;
            try {
                module = importTS(path.resolve(filepath));
            }
            catch (e) { }
            if (module?.serviceProto) {
                return module.serviceProto;
            }

            // ts-node 解析失败：由于上面检测过，文件必定存在，所以此时应该是 serviceProto.ts 编译报错
            // 尝试通过字符串匹配方式解析 ServiceProto
            if (useRegExpWhenTsError) {
                // Read file
                let fileContent = await fs.readFile(filepath, 'utf-8').catch();
                if (fileContent) {
                    // Match ServiceProto by RegExp
                    let match = fileContent.match(/export const serviceProto: ServiceProto<ServiceType> = (\{[\s\S]+\});/);
                    if (match) {
                        try {
                            let proto = JSON.parse(match[1]);
                            return proto;
                        }
                        catch { }
                    }
                }
            }

            // 解析失败
            logger?.error(formatStr(i18n.protoParsedError, { file: path.resolve(filepath) }));
            return undefined;
        }
        else if (filepath.endsWith('.json')) {
            // 打开OldFile
            let fileContent = (await fs.readFile(filepath)).toString()
            try {
                return JSON.parse(fileContent);
            }
            catch (e) {
                logger?.error(formatStr(i18n.protoParsedError, { file: path.resolve(filepath) }));
                return undefined;
            }
        }
        else {
            logger?.warn(formatStr(i18n.invalidProtoExt, { file: path.resolve(filepath) }));
            return undefined;
        }
    }

    static async parseProtoAndSchema(proto: string | undefined, schemaId: string | undefined): Promise<{
        proto: TSBufferProto,
        schemaId: string
    }> {
        // #region 解析Proto
        if (!proto) {
            throw error(i18n.missingParam, { param: '--proto' });
        }
        if (!schemaId) {
            throw error(i18n.missingParam, { param: '--schema' });
        }
        let serviceProto: ServiceProto | undefined;
        try {
            serviceProto = await ProtoUtil.loadServiceProto(proto);
        }
        catch (e) {
            throw error((e as Error).message);
        }

        if (!serviceProto) {
            throw error(i18n.fileOpenError, { file: path.resolve(proto) });
        }

        return { proto: serviceProto.types, schemaId: schemaId };
        // #endregion
    }

    /**
     * 生成 ServiceProto
     * @param options
     * @returns
     */
    static async generateServiceProto(options: {
        protocolDir: string,
        oldProto?: {
            proto: ServiceProto<any>,
            path: string
        },
        ignore?: string[] | string,
        checkOptimize?: boolean,
        verbose?: boolean,
        keepComment?: boolean,
        resolveModule?: ProtoGeneratorOptions['resolveModule']
    }): Promise<{
        newProto: ServiceProto<any>,
        isChanged: boolean
    }> {
        const oldProto = options.oldProto?.proto;
        let errMsgs: string[] = [];

        // 标准化路径（抹平系统差异）
        const protocolDir = options.protocolDir.replace(/\\/g, '/').replace(/\/+$/, '');
        // 只能填写文件夹 不支持通配符
        if (!(await fs.stat(options.protocolDir)).isDirectory()) {
            throw error(i18n.shouldBeDir, { path: protocolDir });
        }

        // 查找所有目标 Ptl 和 Msg 文件，输出标准化的相对路径
        let fileList = glob.sync(protocolDir + '/**/{Ptl,Msg}?*.ts', {
            ignore: options.ignore,
        }).map(v => path.relative(protocolDir, v).replace(/\\/g, '/'));

        // 临时切换working dir
        // let originalCwd = process.cwd();
        // process.chdir(protocolDir);

        // 生成 types （TSBufferSchema）
        const EXP_DIR_TYPE_NAME = /^(.+\/)?(Ptl|Msg)([^\.\/\\]+)\.ts$/;
        try {
            var typeProto = await new TSBufferProtoGenerator({
                verbose: options.verbose,
                baseDir: protocolDir,
                customSchemaIds: ['mongodb/ObjectId', 'mongodb/ObjectID', 'bson/ObjectId', 'bson/ObjectID'],
                keepComment: options.keepComment,
                resolveModule: options.resolveModule
            }).generate(fileList, {
                compatibleResult: oldProto?.types,
                filter: info => {
                    let infoPath = info.path.replace(/\\/g, '/')
                    let match = infoPath.match(EXP_DIR_TYPE_NAME);

                    if (!match) {
                        return false;
                    }

                    if (match[2] === 'Ptl') {
                        return info.name === 'Req' + match[3] || info.name === 'Res' + match[3];
                    }
                    else {
                        return info.name === 'Msg' + match[3];
                    }
                },
                logger: options.verbose ? console : undefined
            });
        }
        catch (e: any) {
            e.message = (e.message.startsWith('⨯') ? '' : '⨯ ') + e.message;
            throw e;
        }

        // 生成 services
        let services: ServiceDef[] = [];
        for (let filepath of fileList) {
            let match = filepath.match(EXP_DIR_TYPE_NAME)!;
            let typePath = filepath.replace(/^\.\//, '').replace(/\.ts$/, '');

            // 解析conf
            let tsModule = importTS(path.resolve(protocolDir, filepath));
            let conf: { [key: string]: any } | undefined = tsModule.conf;

            // Ptl 检测 Req 和 Res 类型齐全
            if (match[2] === 'Ptl') {
                let req = typePath + '/Req' + match[3];
                let res = typePath + '/Res' + match[3];
                if (typeProto[req] && typeProto[res]) {
                    services.push({
                        id: services.length,
                        name: (match[1] || '') + match[3],
                        type: 'api',
                        conf: conf
                    })
                }
                else {
                    !typeProto[res] && errMsgs.push(chalk.red(`⨯ Missing type ${chalk.cyan(`Res${match[3]}`)} at ${chalk.cyan(filepath)}`));
                    !typeProto[req] && errMsgs.push(chalk.red(`⨯ Missing type ${chalk.cyan(`Req${match[3]}`)} at ${chalk.cyan(filepath)}`));
                }
            }
            // Msg 检测Msg类型在
            else {
                let msg = typePath + '/Msg' + match[3];
                if (typeProto[msg]) {
                    services.push({
                        id: services.length,
                        name: (match[1] || '') + match[3],
                        type: 'msg',
                        conf: conf
                    })
                }
                else {
                    errMsgs.push(chalk.red(`⨯ Missing type ${chalk.cyan(`Msg${match[3]}`)} at ${chalk.cyan}`));
                }
            }
        }

        // 有 Missing 报错，不生成
        if (errMsgs.length) {
            throw new Error(errMsgs.join('\n'))
        }

        // 检测可优化的 ID 冗余
        let canOptimizeByNew = false;
        EncodeIdUtil.onGenCanOptimized = () => {
            canOptimizeByNew = true;
        }
        // EncodeID 兼容 OldProto
        let encodeIds = EncodeIdUtil.genEncodeIds(services.map(v => v.type + v.name), oldProto?.services.map(v => ({
            key: v.type + v.name,
            id: v.id
        })));
        for (let item of encodeIds) {
            services.find(v => item.key.startsWith(v.type) && v.name === item.key.substr(v.type.length))!.id = item.id;
        }

        let version: number | undefined = oldProto?.version;
        // 只有在旧 Proto 存在，同时协议内容变化的情况下，才更新版本号
        if (oldProto && JSON.stringify({ types: oldProto.types, services: oldProto.services }) !== JSON.stringify({ types: typeProto, services: services })) {
            version = (oldProto.version || 0) + 1;
        }

        // 创建新 Proto
        let newProto: ServiceProto = {
            version: version,
            services: services,
            types: typeProto
        };
        // process.chdir(originalCwd);

        if (options.checkOptimize && canOptimizeByNew && options.oldProto?.path) {
            console.warn(chalk.yellow(i18n.canOptimizeByNew(path.resolve(options.oldProto.path)) + '\n'));
        }

        return {
            newProto: newProto,
            isChanged: newProto.version !== oldProto?.version
        };
    }

    static async outputProto(options: {
        protocolDir: string,
        newProtoPath: string,
        ugly?: boolean,
        proto: ServiceProto<any>,
        /** 当实际 Proto 数据无变化时不重新生成文件 */
        noEmitWhenNoChange?: boolean
    }, logger?: Logger) {
        if (options.noEmitWhenNoChange) {
            // TS 报错也算需要重新生成
            let oldProto = await this.loadServiceProto(options.newProtoPath, undefined, false);
            if (oldProto && JSON.stringify(oldProto) === JSON.stringify(options.proto)) {
                return { emited: false };
            }
        }

        // TS
        if (options.newProtoPath.endsWith('.ts')) {
            let imports: { [path: string]: { srcName: string, asName?: string }[] } = {};
            let apis: { name: string, importPath: string, req: string, res: string }[] = [];
            let msgs: { name: string, importPath: string, msg: string }[] = [];

            // 防止重名
            let usedNames: { [name: string]: 1 } = {};
            let getAsName = (name: string) => {
                while (usedNames[name]) {
                    let match = name.match(/(^.*)\_(\d+)$/);
                    if (match) {
                        let seq = parseInt(match[2]) + 1;
                        name = match[1] + '_' + seq;
                    }
                    else {
                        name = name + '_1';
                    }
                }

                usedNames[name] = 1;
                return name;
            }

            let addImport = (path: string, srcNames: string[]): string[] => {
                let asNames = srcNames.map(v => getAsName(v));
                imports[path] = srcNames.map((v, i) => ({
                    srcName: v,
                    asName: asNames[i] && asNames[i] !== v ? asNames[i] : undefined
                }))

                return asNames;
            }

            for (let svc of options.proto.services) {
                let match = svc.name.replace(/\\/g, '/').match(/^(.*\/)*([^\/]+)$/);
                if (!match) {
                    throw new Error(`Invalid svc name: ${svc.name}`);
                }

                let lastName = match[2];
                let importPath = path.relative(
                    path.dirname(options.newProtoPath),
                    path.join(options.protocolDir, (match[1] || '') + (svc.type === 'api' ? 'Ptl' : 'Msg') + lastName)
                ).replace(/\\/g, '/');
                if (!importPath.startsWith('.')) {
                    importPath = './' + importPath;
                }

                if (svc.type === 'api') {
                    let op = addImport(importPath, ['Req' + lastName, 'Res' + lastName]);
                    apis.push({
                        name: svc.name,
                        importPath: importPath,
                        req: op[0],
                        res: op[1]
                    })
                }
                else {
                    let op = addImport(importPath, ['Msg' + lastName]);
                    msgs.push({
                        name: svc.name,
                        importPath: importPath,
                        msg: op[0]
                    })
                }
            }

            let importStr = Object.entries(imports)
                .map(v => `import { ${v[1].map(w => w.asName ? `${w.srcName} as ${w.asName}` : w.srcName).join(', ')} } from '${v[0]}';`)
                .join('\n');
            let apiStr = apis.map(v => `        ${JSON.stringify(v.name)}: {
            req: ${v.req},
            res: ${v.res}
        }`).join(',\n');
            let msgStr = msgs.map(v => `        ${JSON.stringify(v.name)}: ${v.msg}`).join(',\n');

            let fileContent = `
import { ServiceProto } from 'tsrpc-proto';
${importStr}

export interface ServiceType {
    api: {
${apiStr}
    },
    msg: {
${msgStr}
    }
}

export const serviceProto: ServiceProto<ServiceType> = ${JSON.stringify(options.proto, null, 4)};
`.trim();

            await fs.ensureDir(path.dirname(options.newProtoPath));
            await fs.writeFile(options.newProtoPath, fileContent);
        }
        // JSON
        else {
            await fs.ensureDir(path.dirname(options.newProtoPath));
            await fs.writeFile(options.newProtoPath, options.ugly ? JSON.stringify(options.proto) : JSON.stringify(options.proto, null, 2));
        }
        logger?.log(chalk.green(formatStr(i18n.protoSucc, { output: path.resolve(options.newProtoPath) })));

        return { emited: true };
    }

    static async loadOldProtoByConfigItem(confItem: Pick<NonNullable<TsrpcConfig['proto']>[0], 'compatible' | 'output'>, verbose: boolean | undefined): Promise<{
        proto: ServiceProto<any>,
        path: string
    } | undefined> {
        // old
        let oldProtoPath = confItem.compatible ?? confItem.output;
        let oldProto: ServiceProto<any> | undefined;
        if (oldProtoPath) {
            oldProto = await ProtoUtil.loadServiceProto(oldProtoPath, verbose ? console : undefined);
        }
        verbose && console.log(`oldProtoPath: ${oldProtoPath}, hasOldProto=${!!oldProto}`);

        return oldProto ? {
            proto: oldProto,
            path: oldProtoPath as string
        } : undefined;
    }

    static async genProtoByConfigItem(confItem: Pick<NonNullable<TsrpcConfig['proto']>[0], 'ptlDir' | 'ignore' | 'output' | 'resolveModule'>, old: {
        proto: ServiceProto<any>,
        path: string
    } | undefined, verbose: boolean | undefined, checkOptimize: boolean | undefined, noEmitWhenNoChange?: boolean, keepComment?: boolean) {
        // new
        try {
            var resGenProto = await ProtoUtil.generateServiceProto({
                protocolDir: confItem.ptlDir,
                oldProto: old,
                ignore: confItem.ignore,
                verbose: verbose,
                checkOptimize: checkOptimize,
                resolveModule: confItem.resolveModule
            })
            verbose && console.log(`Proto generated succ, start to write output file...`);
        }
        catch (e: any) {
            console.error(chalk.red(e.message))
            throw new Error(i18n.protoFailed(confItem.output));
        }

        // output
        await ProtoUtil.outputProto({
            protocolDir: confItem.ptlDir,
            newProtoPath: confItem.output,
            proto: resGenProto.newProto,
            noEmitWhenNoChange: noEmitWhenNoChange
        }, console)

        verbose && console.log(`Finish: ${confItem.output}...`);

        return resGenProto.newProto;
    }

    static toJsonSchema() { }
}