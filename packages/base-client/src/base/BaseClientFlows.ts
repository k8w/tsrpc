import { BaseConnectionFlows, Flow, OpResultVoid } from "tsrpc-base";
import { BaseClient } from "./BaseClient";

export type BaseClientFlows<Conn extends BaseClient> = BaseConnectionFlows<Conn, Conn['ServiceType']> & {
    preConnectFlow: Flow<{
        readonly conn: Conn,
        /** Return `res` to `client.connect()`, without latter connect procedure */
        return?: OpResultVoid
    }>,

    // 旧版 Flow 兼容
    /** @deprecated Use `preCallApiReturnFlow` instead. */
    preApiReturnFlow?: never,
    /** @deprecated Use `postSendDataFlow` instead. */
    postApiReturnFlow?: never,
    /** @deprecated Use `postSendDataFlow` instead. */
    postSendMsgFlow?: never,
    /** @deprecated Use `postSendDataFlow` instead. */
    postRecvMsgFlow?: never,
};