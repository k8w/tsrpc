import { BaseConnectionFlows } from "../base/BaseConnectionFlows";
import { BaseServer } from "./BaseServer";

export type BaseServerFlows<Server extends BaseServer> = BaseConnectionFlows<Server['Conn'], Server['Conn']['ServiceType']> & {
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
    /** @deprecated Use `postSendDataFlow` instead */
    postSendMsgFlow?: never,
};