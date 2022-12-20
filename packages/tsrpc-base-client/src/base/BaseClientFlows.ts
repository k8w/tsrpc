import { BaseConnectionFlows, Flow, OpResultVoid } from "tsrpc-base";
import { BaseClient } from "./BaseClient";

export type BaseClientFlows<Conn extends BaseClient> = BaseConnectionFlows<Conn> & {
    preConnectFlow: Flow<{
        readonly conn: Conn
    }>,

    // 旧版 Flow 兼容
    /** @deprecated Use `preCallApiReturnFlow` instead. */
    preApiReturnFlow?: never,
    /** @deprecated Use `postCallApiReturnFlow` instead. */
    postApiReturnFlow?: never,
    /** @deprecated Use `onMsg` instead. */
    postRecvMsgFlow?: never,
};