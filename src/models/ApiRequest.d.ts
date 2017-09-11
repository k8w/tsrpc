import RpcServer from '../RpcServer';
import Protocol from './Protocol';
import { Request } from 'express';

export default interface ApiRequest<T> extends Request {
    rpcServer: RpcServer;
    rpcPtl: Protocol<any, any>;
    rpcUrl: string;
    args: T;
}