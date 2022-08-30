import { Flow } from "../models/Flow";
import { ApiReturn } from "../proto/ApiReturn";
import { ApiCall } from "./ApiCall";
import { BaseConnection } from "./BaseConnection";
import { TransportData } from "./TransportData";

export interface BaseConnectionFlows<Conn extends BaseConnection> {

    // Connect Flows
    postConnectFlow: Flow<Conn>,
    postDisconnectFlow: Flow<{
        readonly conn: Conn,
        /**
         * Whether is is disconnected manually by `client.disconnect()`,
         * otherwise by accident. (e.g. network error, server closed...)
         */
        isManual: boolean,
        /** reason parameter from server-side `conn.close(reason)` */
        reason?: string,
        code?: number
    }>,

    /**
     * API Client Flows (callApi)
     * callApi() 
     *   -> 【preCallApiFlow】
     *   -> send req
     *   -> recv res/err
     *   -> 【preCallApiReturnFlow】
     *   -> return
     */
    preCallApiFlow: Flow<CallApiFlow<Conn>>,
    preCallApiReturnFlow: Flow<CallApiReturnFlow<Conn>>,

    /**
     * API Server Flows (ApiCall)
     * recv ApiCall
     *   -> 【preRecvReqFlow】
     *   -> execute API implementation
     *      -> call.succ() or call.error()
     *          -> 【preApiCallReturnFlow】
     *          -> send response
     *          -> 【postApiCallReturnFlow】
     */
    preApiCallFlow: Flow<ApiCallFlow<Conn>>,
    preApiCallReturnFlow: Flow<ApiCallReturnFlow<Conn>>,
    postApiCallReturnFlow: Flow<ApiCallReturnFlow<Conn>>,

    /**
     * Duplex Message Flows
     * sendMsg() -> 【preSendMsgFlow】 -> send data -> 【postSendMsgFlow】
     * recv MsgCall -> 【preRecvMsgFlow】 -> msg listeners
     */
    preSendMsgFlow: Flow<MsgFlow<Conn>>,
    preRecvMsgFlow: Flow<MsgFlow<Conn>>,

    /**
     * Duplex TransportData Flows
     * sendTransportData() -> 【preSendTransportDataFlow】 -> send data
     * recv TransportData -> 【preRecvTransportDataFlow】 -> ApiCall or MsgCall or commands ...
     */
    preSendDataFlow: Flow<SendDataFlow<Conn>>,
    postSendDataFlow: Flow<SendDataFlow<Conn>>,
    preRecvDataFlow: Flow<RecvDataFlow<Conn>>,
    postRecvCustomDataFlow: Flow<RecvCustomDataFlow<Conn>>,
}

export type CallApiFlow<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        apiName: K & string,
        req: Conn['ServiceType']['api'][K]['req'],
        ret?: ApiReturn<Conn['ServiceType']['api'][K]['res']>,
        readonly conn: Conn
    }
}[keyof Conn['ServiceType']['api']];

export type CallApiReturnFlow<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        apiName: K & string,
        req: Conn['ServiceType']['api'][K]['req'],
        return: ApiReturn<Conn['ServiceType']['api'][K]['res']>,
        readonly conn: Conn
    }
}[keyof Conn['ServiceType']['api']];

export type ApiCallFlow<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: ApiCall<Conn['ServiceType']['api'][K]['req'], Conn['ServiceType']['api'][K]['res'], Conn>
}[keyof Conn['ServiceType']['api']];

export type ApiCallReturnFlow<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['api']]: ApiCall<Conn['ServiceType']['api'][K]['req'], Conn['ServiceType']['api'][K]['res'], Conn> & {
        return: ApiReturn<Conn['ServiceType']['api'][K]['res']>
    }
}[keyof Conn['ServiceType']['api']];

export type MsgFlow<Conn extends BaseConnection<any>> = {
    [K in keyof Conn['ServiceType']['msg']]: {
        msgName: K & string,
        msg: Conn['ServiceType']['msg'][K],
        readonly conn: Conn,
    }
}[keyof Conn['ServiceType']['msg']];

export type SendDataFlow<Conn extends BaseConnection<any>> = {
    data: string | Uint8Array,
    readonly conn: Conn,
    /** Where the data is encoded from */
    readonly transportData: TransportData,
    /** If the data is an ApiReturn, this would be its original ApiCall. */
    readonly call?: ApiCall
};

export type RecvDataFlow<Conn extends BaseConnection<any>> = {
    data: string | Uint8Array,
    parsedTransportData?: TransportData
    readonly conn: Conn,
};

export type RecvCustomDataFlow<Conn extends BaseConnection<any>> = {
    data: TransportData & { type: 'custom' },
    readonly conn: Conn,
};