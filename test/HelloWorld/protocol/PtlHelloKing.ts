import { TsRpcPtl } from "tsrpc-protocol";

/**
 * 返回 `Hello, ${name}!`
 * name为空时返回 `Hello, world!`
 */
const PtlHelloKing = new TsRpcPtl<ReqHelloKing, ResHelloKing>(__filename);
export default PtlHelloKing;

export interface ReqHelloKing {
    name?: string;
}

export interface ResHelloKing {
    reply: string;
}