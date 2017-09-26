import RpcServer from '../RpcServer';
import { TsRpcPtl } from 'tsrpc-protocol';
import { Request } from 'express';

export default interface ApiRequest<T> extends Request {
    rpcServer: RpcServer;
    rpcPtl: TsRpcPtl<any, any>;
    rpcUrl: string;     //形如 `/data/GetData` 以`/`开头，没有`Ptl`
    args: T;
    reqId: string;
}