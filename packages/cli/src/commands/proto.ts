import { i18n } from "../i18n/i18n";
import { ProtoUtil } from "../models/ProtoUtil";
import { TsrpcConfig } from "../models/TsrpcConfig";
import { error } from "../models/util";
import { fillAllPtlAndMsgs } from "./dev";

export type CmdProtoOptions = {
    /** 默认当前文件夹 */
    input: string | undefined,
    output: string | undefined,
    /** 默认同 output */
    compatible: string | undefined,
    ugly: boolean | undefined,
    new: boolean | undefined,
    ignore: string[] | string | undefined,
    verbose: boolean | undefined,
    config: undefined
} | { config: TsrpcConfig }

export async function cmdProto(options: CmdProtoOptions) {
    if (options.config) {
        if (!options.config.proto) {
            throw new Error(i18n.missingConfigItem('proto'))
        }
        for (let conf of options.config.proto) {
            options.config.verbose && console.log(`Start to generate ${conf.output}...`);

            // 填充空白协议文件
            await fillAllPtlAndMsgs(conf);

            // old
            let old = await ProtoUtil.loadOldProtoByConfigItem(conf, options.config.verbose);

            // new
            await ProtoUtil.genProtoByConfigItem(conf, old, options.config.verbose, options.config.checkOptimizableProto)
        }
    }
    else {
        // 检查参数
        if (!options.input) {
            throw error(i18n.missingParam, { param: 'input' });
        }
        if (!options.output) {
            throw error(i18n.missingParam, { param: 'output' });
        }

        // oldProto
        let old = await ProtoUtil.loadOldProtoByConfigItem({
            compatible: options.compatible,
            output: options.output
        }, options.verbose);

        // newProto
        await ProtoUtil.genProtoByConfigItem({
            ptlDir: options.input,
            ignore: options.ignore,
            output: options.output
        }, old, options.verbose, true)
    }
}