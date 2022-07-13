import fs from "fs";
import path from "path";
import 'ts-node/register';
import { i18n } from "../i18n/i18n";
import { TsrpcConfig } from "./TsrpcConfig";
import { error } from "./util";

const watchingFiles: {
    [path: string]: 1
} = {};
/**
 * 引入 TS 模块，但不缓存
 */
export function importTS(modulePath: string, ignoreTypeError?: boolean): { [key: string]: any } {
    modulePath = path.resolve(modulePath);

    if (!fs.existsSync(modulePath)) {
        throw error(i18n.fileNotExists, { file: modulePath })
    }

    let module: any;
    // 忽略类型报错
    if (ignoreTypeError) {
        let oldEnv = process.env['TS_NODE_TRANSPILE_ONLY'];
        process.env['TS_NODE_TRANSPILE_ONLY'] = 'true';
        try {
            module = require(modulePath);
        }
        finally {
            process.env['TS_NODE_TRANSPILE_ONLY'] = oldEnv;
        }        
    }
    else {
        module = require(modulePath);
    }
    
    delete require.cache[modulePath]
    return module;
}

export function importTsrpcConfig(modulePath: string): TsrpcConfig {
    let module = importTS(modulePath, true);
    let conf = module['default'] ?? module['conf'] ?? module['config'];
    if (!conf) {
        throw error(i18n.confInvalid, { path: path.resolve(modulePath) })
    }
    return conf;
}