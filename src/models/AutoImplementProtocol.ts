import * as fs from 'fs';
import * as path from 'path';
import TsRpcServer from '../TsRpcServer';

interface PtlDef {
    name: string;
    path: string;
}

/**
 * 遍历目录下的所有PtlXXX文件
 * 注意：会忽略“~”开头的文件和文件夹
 * @param protocolPath 
 * @param output 
 */
function getPtlPath(protocolPath: string, output?: PtlDef[]) {
    if (!output) {
        output = [];
    }

    let list = fs.readdirSync(protocolPath);
    for (let v of list) {
        let stat = fs.statSync(path.resolve(protocolPath, v));
        if (stat.isDirectory()) {
            getPtlPath(path.resolve(protocolPath, v), output);
        }
        else {
            let matches = v.match(/^Ptl(\w+)\.ts$/);
            if (matches) {
                let ptlName = matches[1];
                output.push({
                    name: ptlName,
                    path: protocolPath
                })
            }
        }
    }

    return output;
}
function getPtlRelativePath(protocolPath: string): PtlDef[] {
    let ptls = getPtlPath(protocolPath);
    for (let v of ptls) {
        v.path = path.relative(protocolPath, v.path)
    }
    return ptls;
}

/**
 * Auto implement protocols (protocolPath -> apiPath)
 * @return null represent succ, otherwise is errmsgs
 */
export default function AutoImplementProtocol(server: TsRpcServer, protocolPath: string, apiPath: string): string[] | null {
    let ptls = getPtlRelativePath(protocolPath);
    let errorMsgs: string[] = []
    for (let ptl of ptls) {
        //get Ptl
        let protocol: any;
        try {
            protocol = require(path.resolve(protocolPath, ptl.path, 'Ptl' + ptl.name)).default;
        }
        catch (e) {
            errorMsgs.push(path.resolve(protocolPath, ptl.path, 'Ptl' + ptl.name) + ': ' + e.message)
            continue;
        }

        //get matched Api
        let api: any;
        try {
            api = require(path.resolve(apiPath, ptl.path, 'Api' + ptl.name)).default;
        }
        catch (e) {
            //未指定forceAutoImplementAll 忽略找不到API的
            if (e.code == 'MODULE_NOT_FOUND' && !server.config.forceAutoImplementAll) {
                console.warn('Api not found: ' + path.resolve(apiPath, ptl.path, 'Api' + ptl.name));
                continue;
            }
            else {
                errorMsgs.push(path.resolve(apiPath, ptl.path, 'Api' + ptl.name) + ': ' + e.message)
                continue;
            }
        }

        // console.debug('自动注册协议', ptl.path, ptl.name, protocol.url);
        server.implementPtl(protocol, api);
    }

    return errorMsgs.length ? errorMsgs : null;
}