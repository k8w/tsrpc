import RpcServer from '../RpcServer';
import Protocol from './Protocol';
import { Response } from 'express';
import PtlResponse from './Response';

export default interface ApiResponse<T> extends Response {
    /**
     * TSRPC Server instance
     */
    rpcServer: RpcServer;

    /**
     * Send successful response
     */
    succ: (body: T) => void;

    /**
     * Send error response
     */
    error: (errmsg?: string, errinfo?: any) => void;

    /**
     * final output body by res.succ or res.error
     */
    output?: PtlResponse;
}