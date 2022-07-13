import chalk from "chalk";
import { error } from "console";
import fs from "fs-extra";
import path from "path";
import { ApiServiceDef, Logger, ServiceProto } from "tsrpc-proto";
import { CodeTemplate } from "..";
import { i18n } from "../i18n/i18n";
import { ProtoUtil } from "../models/ProtoUtil";
import { ApiTemplate, TsrpcConfig } from "../models/TsrpcConfig";
import { formatStr } from "../models/util";

export type CmdApiOptions = {
    input: string | undefined,
    output: string | undefined,
    config?: undefined
} | { config: TsrpcConfig }

export async function cmdApi(options: CmdApiOptions) {
    if (options.config) {
        if (!options.config.proto) {
            throw new Error(i18n.missingConfigItem('proto'))
        }

        let newCount = 0;
        for (let conf of options.config.proto) {
            if (!conf.apiDir) {
                continue;
            }
            let proto = await ProtoUtil.loadServiceProto(conf.output, options.config.verbose ? console : undefined);
            if (!proto) {
                console.warn(chalk.yellow(formatStr(i18n.protoParsedError, { file: path.resolve(conf.output) })))
                continue;
            }

            let res = await genApiFilesByProto({
                proto: proto,
                ptlDir: conf.ptlDir,
                apiDir: conf.apiDir,
                template: conf.newApiTemplate ?? CodeTemplate.defaultApi
            }, console);

            newCount += res.length;
        }

        console.log(chalk.green(formatStr(i18n.allApiSucc, { newCount: '' + newCount })))
    }
    else {
        if (!options.input) {
            throw error(i18n.missingParam, { param: 'input' });
        }
        if (!options.output) {
            throw error(i18n.missingParam, { param: 'output' });
        }

        let proto = await ProtoUtil.loadServiceProto(options.input);
        if (!proto) {
            throw error(i18n.protoParsedError, { file: options.input });
        }

        let res = await genApiFilesByProto({
            proto: proto,
            ptlDir: path.dirname(options.input),
            apiDir: options.output,
            template: undefined
        }, console);

        console.log(chalk.green(formatStr(i18n.allApiSucc, { newCount: '' + res.length })))
    }
}

export function getApiFileInfo(apiSvcName: string, apiDir: string, ptlDir: string) {
    let apiBaseName = apiSvcName.match(/\w+$/)![0];
    /** a/b/c/Test  apiBaseName='Test' apiBasePath='a/b/c/' */
    let apiBasePath = apiSvcName.substr(0, apiSvcName.length - apiBaseName.length);
    /** API src files dir */
    let apiFileDir = path.join(apiDir, apiBasePath);
    /** API src .ts file pathname */
    let apiFilePath = path.join(apiFileDir, `Api${apiBaseName}.ts`);
    /** Ptl src files dir */
    let ptlFileDir = path.join(ptlDir, apiBasePath);

    return {
        apiBaseName,
        apiBasePath,
        apiFileDir,
        apiFilePath,
        ptlFileDir
    }
}

export async function genApiFilesByProto(options: {
    proto: ServiceProto<any>,
    ptlDir: string,
    apiDir: string,
    template: ApiTemplate | undefined
}, logger?: Logger) {
    let apis = options.proto.services.filter(v => v.type === 'api') as ApiServiceDef[];
    let generatedFiles: { apiFilePath: string, apiBaseName: string }[] = [];
    for (let api of apis) {
        let { apiBaseName, apiFilePath, apiFileDir, ptlFileDir } = getApiFileInfo(api.name, options.apiDir, options.ptlDir);
        await genNewApiFile(apiBaseName, apiFilePath, apiFileDir, ptlFileDir, options.template ?? CodeTemplate.defaultApi)
        generatedFiles.push({ apiFilePath: apiFilePath, apiBaseName: apiBaseName })
        logger?.log(chalk.green(formatStr(i18n.apiSucc, { apiPath: apiFilePath, apiName: apiBaseName })));
    }

    return generatedFiles;
}

export async function genNewApiFile(apiBaseName: string, apiFilePath: string, apiFileDir: string, ptlFileDir: string, template: ApiTemplate) {
    /** Files exists already, skip */
    if (!await fs.access(apiFilePath).catch(() => true)) {
        return;
    }
    await fs.ensureDir(path.dirname(apiFilePath));
    await fs.writeFile(apiFilePath, template(apiBaseName, apiFileDir, ptlFileDir), { encoding: 'utf-8' })
}

