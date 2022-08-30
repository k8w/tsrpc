import { BaseConnectionFlows } from "../base/BaseConnectionFlows";
import { BaseClient } from "./BaseClient";

export type BaseClientFlows<Conn extends BaseClient> = BaseConnectionFlows<Conn> & {
    // 旧版 Flow 兼容
    /** @deprecated Use `preCallApiReturnFlow` instead. */
    preApiReturnFlow?: never,
    /** @deprecated Use `postSendDataFlow` instead. */
    postApiReturnFlow?: never,
    /** @deprecated Use `postSendDataFlow` instead. */
    postSendMsgFlow?: never,
    /** @deprecated Use `postSendDataFlow` instead. */
    postRecvMsgFlow?: never
};