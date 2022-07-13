import chalk from "chalk";
import { error } from "console";
import fs from "fs";
import path from "path";
import { TSBuffer } from "tsbuffer";
import { i18n } from "../i18n/i18n";
import { ProtoUtil } from "../models/ProtoUtil";
import { buf2Hex, formatStr } from "../models/util";

export interface CmdEncodeOptions {
    input: string | undefined,
    exp: string | undefined,
    output: string | undefined,
    proto: string | undefined,
    schemaId: string | undefined,
    verbose: boolean | undefined
}

export async function cmdEncode(options: CmdEncodeOptions) {
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
    else if (options.exp) {
        try {
            inputValue = eval(`()=>(${options.exp})`)();
        }
        catch (e) {
            if (options.verbose) {
                console.log('exp', options.exp);
                console.error(e);
            }
            throw error(i18n.expParsedError);
        }
    }
    else {
        throw error(i18n.missingParam, { param: `--input ${i18n.or} [expression]` });
    }
    // #endregion

    options.verbose && console.log('inputValue', inputValue);
    let opEncode = new TSBuffer(parsedProto.proto).encode(inputValue, parsedProto.schemaId);
    if (!opEncode.isSucc) {
        throw error('编码失败。\n    ' + opEncode.errMsg)
    }
    console.log('编码长度：' + opEncode.buf.byteLength);
    if (options.output) {
        fs.writeFileSync(options.output, opEncode.buf);
        console.log(chalk.green(formatStr(i18n.encodeSucc, { output: path.resolve(options.output) })));
    }
    else {
        console.log(chalk.yellow(buf2Hex(opEncode.buf)));
    }
}