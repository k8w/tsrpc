import * as fs from 'fs';
import * as path from 'path';
import TsRpcServer from '../TsRpcServer';

interface PtlDef {
    name: string;
    path: string;
}
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
        let protocol: any;
        let api: any;
        try {
            protocol = require(path.resolve(protocolPath, ptl.path, 'Ptl' + ptl.name)).default;
        }
        catch (e) {
            errorMsgs.push(path.resolve(protocolPath, ptl.path, 'Ptl' + ptl.name) +': ' +e.message)
            continue;
        }

        try {
            api = require(path.resolve(apiPath, ptl.path, 'Api' + ptl.name)).default;
        }
        catch (e) {
            errorMsgs.push(path.resolve(apiPath, ptl.path, 'Api' + ptl.name) + ': ' + e.message)
            continue;
        }

        // console.debug('自动注册协议', ptl.path, ptl.name, protocol.url);
        server.implementPtl(protocol, api);
    }

    return errorMsgs.length ? errorMsgs : null;
}