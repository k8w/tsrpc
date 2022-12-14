import { Overwrite } from "tsbuffer-schema";
import { BaseConnectionFlows, Flow, MsgFlow, SendDataFlow } from "tsrpc-base";
import { BaseServerConnection } from "./BaseServerConnection";

export type BaseServerFlows<Conn extends BaseServerConnection> = Overwrite<BaseConnectionFlows<Conn>, {
    preSendMsgFlow: Flow<MsgFlow<Conn> & {
        /** When `server.broadcastMsg()`, preSendDataFlow would only run once, with this param. (`conn` would be `conns[0]`) */
        /** This property would be set if it is under `server.broadcastMsg()`. */
        readonly conns?: Conn[]
    }>,
    postSendMsgFlow: Flow<MsgFlow<Conn> & {
        /** When `server.broadcastMsg()`, preSendDataFlow would only run once, with this param. (`conn` would be `conns[0]`) */
        readonly conns?: Conn[]
    }>,
    preSendDataFlow: Flow<SendDataFlow<Conn> & {
        /** When `server.broadcastMsg()`, preSendDataFlow would only run once, with this param. (`conn` would be `conns[0]`) */
        readonly conns?: Conn[]
    }>,
    postSendDataFlow: Flow<SendDataFlow<Conn> & {
        /** When `server.broadcastMsg()`, postSendDataFlow would only run once, with this param. (`conn` would be `conns[0]`) */
        readonly conns?: Conn[]
    }>,

    /** @deprecated Use `preRecvDataFlow` instead */
    preRecvBufferFlow?: never,
    /** @deprecated Use `preSendDataFlow` instead */
    preSendBufferFlow?: never,
    /** @deprecated Use `preApiCallReturnFlow` instead */
    preApiReturnFlow?: never,
    /** @deprecated Use `postApiCallReturnFlow` instead */
    postApiReturnFlow?: never,
    /** @deprecated Use `postApiCallReturnFlow` instead */
    postApiCallFlow?: never,
    /** @deprecated Use `preRecvMsgFlow` instead */
    preMsgCallFlow?: never,
    /** @deprecated Use `onMsg` instead */
    postMsgCallFlow?: never,
}>;

export type BroadcastMsgFlow<Conn extends BaseServerConnection> = {
    [K in keyof Conn['$ServiceType']['msg']]: {
        msgName: K & string,
        msg: Conn['$ServiceType']['msg'][K],
        readonly conns: Conn[],
    }
}[keyof Conn['$ServiceType']['msg']];