import { TsrpcPtl } from "tsrpc-protocol";

/**
 * 返回 `Hello, ${name}!`
 * name为空时返回 `Hello, world!`
 */
const PtlHelloWorld = new TsrpcPtl<ReqHelloWorld, ResHelloWorld>(__filename);
export default PtlHelloWorld;

export interface ReqHelloWorld {
    name?: string;
}

export interface ResHelloWorld {
    reply: string;
}