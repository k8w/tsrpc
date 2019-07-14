import { WebSocketConnection } from './WsConnection';
import { ApiServiceDef, MsgServiceDef } from '../proto/ServiceProto';
import { Logger } from './Logger';
import { BaseServerCustomType, Server } from './WsServer';
import { ApiError } from '../proto/TransportData';
export interface BaseCall<ServerCustomType extends BaseServerCustomType> {
    conn: WebSocketConnection<ServerCustomType>;
    logger: Logger;
}

export interface ApiCall<Req = any, Res = any, ServerCustomType extends BaseServerCustomType = any> extends BaseCall<ServerCustomType> {
    service: ApiServiceDef,
    sn: number,
    req: Req,

    // res
    succ: (data: Res) => void;
    error: (message: string, info?: any) => void;
    // 已发送的响应
    res?: Res | ApiError,
}

export interface MsgCall<Msg = any, ServerCustomType extends BaseServerCustomType = any> extends BaseCall<ServerCustomType> {
    service: MsgServiceDef,
    msg: Msg
}

export type RPCCall = ApiCall | MsgCall;