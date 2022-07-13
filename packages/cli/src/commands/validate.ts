import chalk from "chalk";
import fs from "fs";
import path from "path";
import { TSBuffer } from "tsbuffer";
import { i18n } from "../i18n/i18n";
import { ProtoUtil } from "../models/ProtoUtil";
import { error } from "../models/util";

export interface CmdValidateOptions {
    proto: string | undefined,
    schemaId: string | undefined,
    input: string | undefined,
    expression: string | undefined,
    verbose: string | undefined
}

export async function cmdValidate(options: CmdValidateOptions) {
    let parsedProto = await ProtoUtil.parseProtoAndSchema(options.proto, options.schemaId);

    // #region 解析Input Value
    let inputValue: any;
    if (options.input) {
        let fileContent: string;
        try {
            fileContent = fs.readFileSync(options.input).toString();
        }
        catch {
            throw error(i18n.fileOpenError, { file: path.resolve(options.input) })
        }
        try {
            inputValue = eval(fileContent);
        }
        catch {
            throw error(i18n.jsParsedError, { file: path.resolve(options.input) });
        }
    }
    else if (options.expression) {
        try {
            inputValue = eval(`()=>(${options.expression})`)();
        }
        catch (e) {
            if (options.verbose) {
                console.log('exp', options.expression);
                console.error(e);
            }
            throw error(i18n.expParsedError);
        }
    }
    else {
        throw error(i18n.missingParam, { param: `--input ${i18n.or} [expression]` });
    }
    // #endregion

    let vRes = new TSBuffer(parsedProto.proto).validate(inputValue, parsedProto.schemaId);
    if (vRes.isSucc) {
        console.log(chalk.green(i18n.validateSucc))
    }
    else {
        throw error(i18n.validateFail, { msg: vRes.errMsg })
    }
}