import { BaseConnectionFlows } from "../base/BaseConnectionFlows";
import { Flow } from "../models/Flow";
import { BaseServiceType } from "../proto/BaseServiceType";
import { BaseServer } from "./BaseServer";
import { BaseServerConnection } from "./BaseServerConnection";

export type BaseServerFlows<Server extends BaseServer> = BaseConnectionFlows<Server['Conn'], Server['Conn']['ServiceType']> & {
    preBroadcastMsgFlow: Flow<BroadcastMsgFlow<Server['Conn'], Server['Conn']['ServiceType']>>,
    
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

export type BroadcastMsgFlow<Conn extends BaseServerConnection<any>, ServiceType extends BaseServiceType> = {
    [K in keyof ServiceType['msg']]: {
        msgName: K & string,
        msg: ServiceType['msg'][K],
        readonly conns: Conn[],
    }
}[keyof ServiceType['msg']];