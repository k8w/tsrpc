import chalk from "chalk";
import childProcess from "child_process";
import fs from "fs-extra";
import path from "path";
import { i18n } from "../i18n/i18n";
import { CliUtil } from "../models/CliUtil";
import { ProtoUtil } from "../models/ProtoUtil";
import { TsrpcConfig } from "../models/TsrpcConfig";
import { error } from "../models/util";
import { genApiFilesByProto } from "./api";
import { ensureSymlinks } from "./link";
import { copyDirReadonly, syncByConfig } from "./sync";

export type CmdBuildOptions = {
    config?: TsrpcConfig
}

export async function cmdBuild(options: CmdBuildOptions) {
    const outDir = path.resolve(options.config?.build?.outDir ?? 'dist');

    if (options.config) {
        const autoProto = options.config.build?.autoProto ?? true;
        const autoSync = options.config.build?.autoSync ?? true;
        const autoApi = options.config.build?.autoApi ?? true;

        // Auto Proto
        if (autoProto && options.config.proto) {
            for (let confItem of options.config.proto) {
                // old
                let old = await ProtoUtil.loadOldProtoByConfigItem(confItem, options.config.verbose);

                // new
                let newProto = await ProtoUtil.genProtoByConfigItem(confItem, old, options.config.verbose, options.config.checkOptimizableProto, true);

                // Auto API
                if (autoApi && newProto && confItem.apiDir) {
                    await genApiFilesByProto({
                        proto: newProto,
                        ptlDir: confItem.ptlDir,
                        apiDir: confItem.apiDir,
                        template: confItem.newApiTemplate
                    })
                }
            }
        }

        // Auto Sync
        if (autoSync && options.config.sync) {
            const logger = options.config.verbose ? console : undefined;
            await syncByConfig(options.config.sync, logger);
        }
    }

    // clean
    CliUtil.doing(i18n.buildClean(outDir));
    await fs.remove(outDir);
    CliUtil.done();

    // tsc
    CliUtil.doing(i18n.buildTsc, '...');
    await new Promise<void>((rs, rj) => {
        let cp = childProcess.spawn('npx', ['tsc'], {
            stdio: 'inherit',
            shell: true
        });
        cp.on('exit', code => {
            if (code) {
                CliUtil.clear();
                rj(error(i18n.codeError));
            }
            else {
                rs();
            }
        })
    });
    CliUtil.done();

    // Copy files
    CliUtil.doing(i18n.buildCopyFiles);
    fs.existsSync('package-lock.json') && fs.copyFileSync('package-lock.json', 'dist/package-lock.json');
    fs.existsSync('yarn.lock') && fs.copyFileSync('yarn.lock', 'dist/yarn.lock');
    // package.json
    let packageJSON = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    packageJSON.scripts = {
        ...packageJSON.scripts,
        start: packageJSON.scripts.start ?? 'node index.js'
    };
    // remove dev scripts
    ['proto', 'sync', 'link', 'api', 'dev', 'build'].forEach(key => {
        delete packageJSON.scripts[key];
    });
    fs.writeFileSync('dist/package.json', JSON.stringify(packageJSON, null, 2), 'utf-8');
    CliUtil.done();

    console.log(`\n ${chalk.bgGreen.white(i18n.buildSucc)} `);
}