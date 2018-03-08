import { TsrpcPtl } from "tsrpc-protocol";

/**
 * 返回 `Hello, ${name}!`
 * name为空时返回 `Hello, world!`
 */
const PtlHelloKing = new TsrpcPtl<ReqHelloKing, ResHelloKing>(__filename);
export default PtlHelloKing;

export interface ReqHelloKing {
    
}

export interface ResHelloKing {
    reply: string;
}