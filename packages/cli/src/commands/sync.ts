import chalk from "chalk";
import fs from "fs-extra";
import { glob } from "glob";
import path from "path";
import { Logger } from "tsrpc-proto";
import { i18n } from "../i18n/i18n";
import { CliUtil } from "../models/CliUtil";
import { TsrpcConfig } from "../models/TsrpcConfig";
import { error } from "../models/util";
import { ensureSymlinks } from "./link";

export type CmdSyncOptions = {
    from: string | undefined,
    to: string | undefined,
    verbose: boolean | undefined,
    config: undefined
} | { config: TsrpcConfig }

export async function cmdSync(options: CmdSyncOptions) {
    if (options.config) {
        if (!options.config.sync?.length) {
            console.log(chalk.yellow(i18n.nothingSyncConf));
            return;
        }

        await syncByConfig(options.config.sync, options.config.verbose ? console : undefined);
        console.log(chalk.green(i18n.allSyncedSucc))
    }
    else {
        // Validate options
        if (!options.from) {
            throw error(i18n.missingParam, { param: 'from' });
        }
        if (!options.to) {
            throw error(i18n.missingParam, { param: 'to' });
        }
        if (await fs.access(options.from).catch(() => true)) {
            throw error(i18n.dirNotExists, { dir: path.resolve(options.from) })
        }

        CliUtil.doing(`${i18n.copy} '${path.resolve(options.from)}' -> '${path.resolve(options.to)}'`);
        await copyDirReadonly(options.from, options.to, true, true, options.verbose ? console : undefined);
        CliUtil.done(true);
        console.log(chalk.green(i18n.syncedSucc))
    }
}

export async function syncByConfig(syncConfig: NonNullable<TsrpcConfig['sync']>, logger: Logger | undefined) {
    if (!syncConfig.length) {
        return;
    }

    // Copy
    for (let item of syncConfig) {
        if (item.type === 'copy') {
            CliUtil.doing(`${i18n.copy} '${item.from}' -> '${item.to}'`);
            await copyDirReadonly(item.from, item.to, !!item.clean, item.readonly ?? true, logger);
            CliUtil.done(true);
        }
    }

    // Symlinks
    await ensureSymlinks(syncConfig.filter(v => v.type === 'symlink').map(v => ({
        src: v.from,
        dst: v.to
    })), console);
}

export async function copyDirReadonly(src: string, dst: string, clean: boolean, readonly: boolean, logger?: Logger) {
    // Clean
    if (clean) {
        logger?.debug(`Start to clean '${dst}'`)
        await fs.remove(dst);
        logger?.debug(`Cleaned succ`)
    }

    // Copy
    logger?.debug(`Start to copy '${src}' to '${dst}'`)
    await fs.ensureDir(dst);
    await fs.copy(src, dst);
    logger?.debug('Copyed succ');

    // Readonly (chmod 0o444)
    readonly && setReadonlyRecursive(dst, logger);
}

export async function setReadonlyRecursive(dst: string, logger?: Logger) {
    logger?.debug(`Start to setReadonlyRecursive to '${dst}'`)
    let items = await new Promise<string[]>((rs, rj) => {
        glob(path.resolve(dst, '**'), (err, matches) => {
            err ? rj() : rs(matches);
        })
    })

    for (let item of items) {
        let stat = fs.statSync(item);

        if (stat.isFile()) {
            await fs.chmod(item, 0o444);
            logger?.log(chalk.green('chmod 444: ' + item));
        }
    }

    logger?.debug('setReadonlyRecursive succ');
}