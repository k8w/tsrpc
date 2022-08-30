import { BaseConnectionFlows } from "../base/BaseConnectionFlows";
import { Flow } from "../models/Flow";
import { OpResult } from "../models/OpResult";
import { BaseClient } from "./BaseClient";

export type BaseClientFlows<Conn extends BaseClient> = BaseConnectionFlows<Conn> & {
    preConnectFlow: Flow<{
        readonly conn: Conn,
        /** Return `res` to `client.connect()`, without latter connect procedure */
        return?: OpResult<void>
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