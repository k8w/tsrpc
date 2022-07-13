import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { ProtoGeneratorOptions } from "tsbuffer-proto-generator";
import { ServiceProto } from "tsrpc-proto";
import { i18n } from "../i18n/i18n";
import { ApiDocUtil } from "../models/ApiDocUtil";
import { ProtoUtil } from "../models/ProtoUtil";
import { TSAPI } from "../models/TSAPI";
import { TsrpcConfig } from "../models/TsrpcConfig";
import { error } from "../models/util";

export type CmdDocOptions = {
    input: string | undefined,
    output: string | undefined,
    ignore: string | undefined,
    verbose: boolean | undefined,
    config?: undefined
} | { config: TsrpcConfig }

export async function cmdDoc(options: CmdDocOptions) {
    if (options.config) {
        if (!options.config.proto) {
            throw new Error(i18n.missingConfigItem('proto'))
        }
        for (let conf of options.config.proto) {
            options.config.verbose && console.log(`Start to generate ${conf.output}...`);
            if (!conf.docDir) {
                continue;
            }
            await generate(conf.ptlDir, conf.docDir, conf.ignore, options.config.verbose, conf.resolveModule);
            console.log(chalk.bgGreen.white(i18n.success));
        }
    }
    else {
        // 检查参数
        if (typeof options.input !== 'string') {
            throw error(i18n.missingParam, { param: 'input' });
        }
        if (typeof options.output !== 'string') {
            throw error(i18n.missingParam, { param: 'output' });
        }

        await generate(options.input, options.output, options.ignore, options.verbose, undefined);
        console.log(chalk.bgGreen.white(i18n.success));
    }
}

async function generate(ptlDir: string, outDir: string, ignore: string | string[] | undefined, verbose: boolean | undefined, resolveModule: ProtoGeneratorOptions['resolveModule']) {
    // Generate proto
    let { newProto } = await ProtoUtil.generateServiceProto({
        protocolDir: ptlDir,
        ignore: ignore,
        verbose: verbose,
        checkOptimize: false,
        keepComment: true,
        resolveModule: resolveModule
    });

    ApiDocUtil.init(newProto);

    await generateOpenApi(newProto, outDir);
    let tsrpcAPI = await generateTSAPI(newProto, outDir);
    await generateMarkdown(tsrpcAPI, outDir);
}

async function generateOpenApi(proto: ServiceProto, outputDir: string) {
    // Generate OpenAPI
    let openAPI = ApiDocUtil.toOpenAPI(proto);

    // Output OpenAPI
    await fs.ensureDir(outputDir);
    let outputPath = path.resolve(outputDir, 'openapi.json');
    await fs.writeFile(outputPath, JSON.stringify(openAPI, null, 2), 'utf-8');
    console.log(chalk.green(i18n.docOpenApiSucc(outputPath)))
}

async function generateTSAPI(proto: ServiceProto, outputDir: string) {
    // Generate OpenAPI
    let tsrpcAPI = await ApiDocUtil.toTSAPI(proto);

    // Output OpenAPI
    // await fs.ensureDir(outputDir);
    // let outputPath = path.resolve(outputDir, 'tsapi.json');
    // await fs.writeFile(outputPath, JSON.stringify(tsrpcAPI, null, 2), 'utf-8');

    // console.log(chalk.green(i18n.docTsapiSucc(outputPath)))
    return tsrpcAPI;
}

async function generateMarkdown(api: TSAPI, outputDir: string) {
    let md = ApiDocUtil.toMarkdown(api);
    await fs.ensureDir(outputDir);
    let outputPath = path.resolve(outputDir, 'tsapi.md');
    await fs.writeFile(outputPath, md, 'utf-8');
    console.log(chalk.green(i18n.docMdSucc(outputPath)))

}