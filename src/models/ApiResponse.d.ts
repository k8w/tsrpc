import RpcServer from '../RpcServer';
import { TsRpcPtl, TsRpcRes } from 'tsrpc-protocol';
import { Response } from 'express';

export default interface ApiResponse<T> extends Response {
    /**
     * TSRPC Server instance
     */
    rpcServer: RpcServer;

    /**
     * Send successful response
     */
    succ: (body: T) => Promise<void>;

    /**
     * Send error response
     */
    error: (errmsg?: string, errinfo?: any) => Promise<void>;

    /**
     * final output body by res.succ or res.error
     */
    rpcOutput?: TsRpcRes;
}