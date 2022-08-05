import { Flow } from "../models/Flow";
import { TransportOptions } from "../models/TransportOptions";
import { ApiReturn } from "../proto/ApiReturn";
import { ApiCall } from "./ApiCall";
import { BaseConnection, TransportData } from "./BaseConnection";

export interface BaseConnectionFlows<Conn extends BaseConnection<any>> {
    /**
     * API Client Flows (callApi)
     * callApi() 
     *   -> 【preCallApiFlow】
     *   -> send req
     *   -> recv res/err
     *   -> 【postCallApiFlow】
     * -> return
     */
    preCallApiFlow: Flow<PreCallApiFlowData<Conn>>,
    postCallApiFlow: Flow<PostCallApiFlowData<Conn>>,

    /**
     * API Server Flows (ApiCall)
     * recv ApiCall
     *   -> 【preApiCallFlow】
     *   -> execute API implementation
     *      -> call.succ() or call.error()
     *          -> 【postApiCallFlow】
     *          -> send response
     */
    preApiCallFlow: Flow<PreApiCallFlowData<Conn>>,
    postApiCallFlow: Flow<PostApiCallFlowData<Conn>>,

    /**
     * Duplex Message Flows
     * sendMsg() -> 【preSendMsgFlow】 -> send data -> 【postSendMsgFlow】
     * recv MsgCall -> 【preRecvMsgFlow】 -> msg listeners
     */
    preSendMsgFlow: Flow<SendMsgFlowData<Conn>>,
    postSendMsgFlow: Flow<SendMsgFlowData<Conn>>,
    preRecvMsgFlow: Flow<PreRecvMsgFlowData<Conn>>,

    /**
     * Duplex TransportData Flows
     * sendTransportData() -> 【preSendTransportDataFlow】 -> send data
     * recv TransportData -> 【preRecvTransportDataFlow】 -> ApiCall or MsgCall or commands ...
     */
    preSendTransportDataFlow: Flow<TransportDataFlowData<Conn>>,
    preRecvTransportDataFlow: Flow<TransportDataFlowData<Conn>>,
}

export type PreCallApiFlowData<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        apiName: K & string,
        req: Conn['ServiceType']['api'][K]['req'],
        options?: TransportOptions,
        return?: ApiReturn<Conn['ServiceType']['api'][K]['res']>,
        readonly conn: Conn,
    }
}[keyof Conn['ServiceType']['api']];

export type PostCallApiFlowData<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        apiName: K & string,
        req: Conn['ServiceType']['api'][K]['req'],
        options?: TransportOptions,
        return: ApiReturn<Conn['ServiceType']['api'][K]['res']>,
        readonly conn: Conn,
    }
}[keyof Conn['ServiceType']['api']];

export type PreApiCallFlowData<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        call: ApiCall<Conn['ServiceType']['api'][K]['req'], Conn['ServiceType']['api'][K]['res'], Conn>,
        readonly conn: Conn,
    }
}[keyof Conn['ServiceType']['api']];

export type PostApiCallFlowData<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        call: ApiCall<Conn['ServiceType']['api'][K]['req'], Conn['ServiceType']['api'][K]['res'], Conn> & {
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

export type PreRecvMsgFlowData<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['msg']]: {
        msgName: K & string,
        msg: Conn['ServiceType']['msg'][K],
        readonly conn: Conn,
    }
}[keyof Conn['ServiceType']['msg']];

export type TransportDataFlowData<Conn extends BaseConnection<any>> = {
    transportData: TransportData,
    readonly conn: Conn,
};