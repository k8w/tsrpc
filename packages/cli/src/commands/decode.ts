import chalk from "chalk";
import { error } from "console";
import fs from "fs";
import path from "path";
import { TSBuffer } from "tsbuffer";
import { i18n } from "../i18n/i18n";
import { ProtoUtil } from "../models/ProtoUtil";
import { colorJson, formatStr, hex2Bin } from "../models/util";

export interface CmdDecodeOptions {
    protoPath: string | undefined,
    schemaId: string | undefined,
    input: string | undefined,
    binStr: string | undefined,
    output: string | undefined,
    verbose: boolean | undefined
}

export async function cmdDecode(options: CmdDecodeOptions) {
    let parsedProto = await ProtoUtil.parseProtoAndSchema(options.protoPath, options.schemaId);
    let inputBuf: Buffer;

    if (options.input) {
        try {
            inputBuf = fs.readFileSync(options.input);
        }
        catch (e) {
            options.verbose && console.error(e);
            throw error(i18n.fileOpenError, { file: path.resolve(options.input) })
        }
    }
    else if (options.binStr) {
        inputBuf = hex2Bin(options.binStr);
    }
    else {
        throw error(i18n.missingParam, { param: `--input ${i18n.or} [binstr]` });
    }

    let decodedValue: any;
    try {
        decodedValue = new TSBuffer(parsedProto.proto).decode(new Uint8Array(inputBuf), parsedProto.schemaId);
    }
    catch (e) {
        throw error('解码失败:\n    ' + (e as Error).message)
    }

    if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(decodedValue, null, 2));
        console.log(chalk.green(formatStr(i18n.decodeSucc, { output: options.output })))
    }
    else {
        console.log(colorJson(decodedValue))
    }
}