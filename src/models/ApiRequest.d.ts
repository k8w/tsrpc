import TsrpcServer from '../TsrpcServer';
import { TsrpcPtl } from 'tsrpc-protocol';
import { Request } from 'express';

export default interface ApiRequest<T> extends Request {
    rpcServer: TsrpcServer;
    rpcPtl: TsrpcPtl<any, any>;
    rpcUrl: string;     //形如 `/data/GetData` 以`/`开头，没有`Ptl`
    args: T;
    reqId: string;
    realIp: string;     //RealIP parsed by X-Forwarded-For
}