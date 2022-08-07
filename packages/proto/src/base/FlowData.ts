import { Flow } from "../models/Flow";
import { TransportOptions } from "../models/TransportOptions";
import { ApiReturn } from "../proto/ApiReturn";
import { ApiCall } from "./ApiCall";
import { BaseConnection } from "./BaseConnection";

export interface BaseConnectionFlows<Conn extends BaseConnection<any>> {
    /**
     * API Client Flows (callApi)
     * callApi() 
     *   -> 【preSendReqFlow】
     *   -> send req
     *   -> 【postSendReqFlow】
     *   -> recv res/err
     *   -> 【preRecvRetFlow】
     * -> return
     */
    preSendReqFlow: Flow<SendReqFlowData<Conn>>,
    postSendReqFlow: Flow<SendReqFlowData<Conn>>,
    preRecvRetFlow: Flow<RecvRetFlowData<Conn>>,

    /**
     * API Server Flows (ApiCall)
     * recv ApiCall
     *   -> 【preRecvReqFlow】
     *   -> execute API implementation
     *      -> call.succ() or call.error()
     *          -> 【preSendRetFlow】
     *          -> send response
     *          -> 【postSendRetFlow】
     */
    preRecvReqFlow: Flow<RecvReqFlow<Conn>>,
    preSendRetFlow: Flow<SendRetFlow<Conn>>,
    postSendRetFlow: Flow<SendRetFlow<Conn>>,

    /**
     * Duplex Message Flows
     * sendMsg() -> 【preSendMsgFlow】 -> send data -> 【postSendMsgFlow】
     * recv MsgCall -> 【preRecvMsgFlow】 -> msg listeners
     */
    preSendMsgFlow: Flow<SendMsgFlowData<Conn>>,
    postSendMsgFlow: Flow<SendMsgFlowData<Conn>>,
    preRecvMsgFlow: Flow<RecvMsgFlowData<Conn>>,
    // postRecvMsgFlow: Flow<RecvMsgFlowData<Conn>>,

    /**
     * Duplex TransportData Flows
     * sendTransportData() -> 【preSendTransportDataFlow】 -> send data
     * recv TransportData -> 【preRecvTransportDataFlow】 -> ApiCall or MsgCall or commands ...
     */
    // preSendTransportDataFlow: Flow<TransportDataFlowData<Conn>>,
    // preRecvTransportDataFlow: Flow<TransportDataFlowData<Conn>>,
}

export type SendReqFlowData<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        apiName: K & string,
        req: Conn['ServiceType']['api'][K]['req'],
        ret?: ApiReturn<Conn['ServiceType']['api'][K]['res']>,
        options?: TransportOptions,
        readonly conn: Conn,

        /** @deprecated Use `ret` instead */
        return?: ApiReturn<Conn['ServiceType']['api'][K]['res']>,
    }
}[keyof Conn['ServiceType']['api']];

export type RecvRetFlowData<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        apiName: K & string,
        req: Conn['ServiceType']['api'][K]['req'],
        ret: ApiReturn<Conn['ServiceType']['api'][K]['res']>,
        options?: TransportOptions,
        readonly conn: Conn,

        /** @deprecated Use `ret` instead */
        return: ApiReturn<Conn['ServiceType']['api'][K]['res']>,
    }
}[keyof Conn['ServiceType']['api']];

export type RecvReqFlow<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        call: ApiCall<Conn['ServiceType']['api'][K]['req'], Conn['ServiceType']['api'][K]['res'], Conn>,
        readonly conn: Conn,
    }
}[keyof Conn['ServiceType']['api']];

export type SendRetFlow<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        call: ApiCall<Conn['ServiceType']['api'][K]['req'], Conn['ServiceType']['api'][K]['res'], Conn> & {
            ret: ApiReturn<Conn['ServiceType']['api'][K]['res']>

            /** @deprecated Use `ret` instead */
            return: ApiReturn<Conn['ServiceType']['api'][K]['res']>
        },
        readonly conn: Conn,
    }
}[keyof Conn['ServiceType']['api']];

export type SendMsgFlowData<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['msg']]: {
        msgName: K & string,
        msg: Conn['ServiceType']['msg'][K],
        options?: TransportOptions,
        readonly conn: Conn,
    }
}[keyof Conn['ServiceType']['msg']];

export type RecvMsgFlowData<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['msg']]: {
        msgName: K & string,
        msg: Conn['ServiceType']['msg'][K],
        readonly conn: Conn,
    }
}[keyof Conn['ServiceType']['msg']];

// export type TransportDataFlowData<Conn extends BaseConnection<any>> = {
//     transportData: TransportData,
//     readonly conn: Conn,
// };


// TEST
export type ApiFlowData<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: ApiCall<Conn['ServiceType']['api'][K]['req'], Conn['ServiceType']['api'][K]['res'], Conn>
}[keyof Conn['ServiceType']['api']];