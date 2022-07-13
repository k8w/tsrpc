import chalk from "chalk";
import { error } from "console";
import fs from "fs";
import path from "path";
import { i18n } from "../i18n/i18n";
import { buf2Hex } from "../models/util";

export interface CmdShowBinOptions {
    file: string,
    verbose: boolean | undefined
}

export function cmdShowBin(options: CmdShowBinOptions) {
    let buf: Uint8Array;
    try {
        buf = new Uint8Array(fs.readFileSync(options.file));
        console.log('编码长度：' + buf.byteLength)
    }
    catch (e) {
        options.verbose && console.error(e);
        throw error(i18n.fileOpenError, { file: path.resolve(options.file) })
    }
    console.log(chalk.yellow(buf2Hex(buf)));
}