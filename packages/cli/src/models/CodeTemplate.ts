import path from "path";
import { ApiTemplate, MsgTemplate, PtlTemplate } from "./TsrpcConfig";

/**
 * 用于 `tsrpc.config.ts` 的代码模板
 * @public
 */
export class CodeTemplate {
    /**
     * 默认 Ptl
     */
    static defaultPtl: PtlTemplate = ptlBaseName =>
        `export interface Req${ptlBaseName} {
    
}

export interface Res${ptlBaseName} {
    
}
`;

    /**
     * 默认 Msg
     */
    static defaultMsg: MsgTemplate = msgBaseName =>
        `export interface Msg${msgBaseName} {
    
}
`;

    /**
     * 默认 Api
     */
    static defaultApi: ApiTemplate = (apiBaseName, apiFileDir, ptlFileDir) =>
        `import { ApiCall } from "tsrpc";
import { Req${apiBaseName}, Res${apiBaseName} } from "${path.relative(apiFileDir, ptlFileDir).replace(/\\/g, '/')}/Ptl${apiBaseName}";

export default async function (call: ApiCall<Req${apiBaseName}, Res${apiBaseName}>) {
    // TODO
    call.error('API Not Implemented');
}`;

    /**
     * 自公共基类继承的 Ptl
     */
    static getExtendedPtl(baseFile = 'src/shared/protocols/base.ts', baseReq = 'BaseRequest', baseRes = 'BaseResponse', baseConf = 'BaseConf'): PtlTemplate {
        return (ptlBaseName, ptlPath, ptlDir) => {
            const importPath = path.relative(path.dirname(ptlPath), path.resolve(baseFile.replace(/\.ts$/, ''))).replace(/\\/g, '/');
            return `import { ${baseReq}, ${baseRes}, ${baseConf} } from "${importPath.startsWith('.') ? importPath : `./${importPath}`}";

export interface Req${ptlBaseName} extends ${baseReq} {
    
}

export interface Res${ptlBaseName} extends ${baseRes} {
    
}

export const conf: ${baseConf} = {
    
}`
        };
    }


    /**
     * 自公共基类继承的 Msg
     */
    static getExtendedMsg(baseFile = 'src/shared/protocols/base.ts', baseMsg = 'BaseMessage', baseConf = 'BaseConf'): MsgTemplate {
        return (msgBaseName, msgPath, msgDir) =>
            `import { ${baseMsg}, ${baseConf} } from "./${path.relative(path.dirname(msgPath), path.resolve(baseFile.replace(/\.ts$/, ''))).replace(/\\/g, '/')}";

export interface Msg${msgBaseName} extends ${baseMsg} {
    
}

export const conf: ${baseConf} = {
    
}`;
    }

}