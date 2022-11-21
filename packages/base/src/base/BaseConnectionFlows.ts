import { Flow } from "../models/Flow";
import { ApiReturn } from "../proto/ApiReturn";
import { ApiCall } from "./ApiCall";
import { BaseConnection, LocalApi, LocalApiName, MsgName, RemoteApi, RemoteApiName } from "./BaseConnection";
import { TransportData } from "./TransportData";

export type BaseConnectionFlows<Conn extends BaseConnection> = {

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
        reason?: string
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
};

export type CallApiFlow<Conn extends BaseConnection> = {
    [K in RemoteApiName<Conn>]: {
        apiName: K,
        req: RemoteApi<Conn>[K]['req'],
        return?: ApiReturn<RemoteApi<Conn>[K]['res']>,
        readonly conn: Conn
    }
}[RemoteApiName<Conn>];

export type CallApiReturnFlow<Conn extends BaseConnection> = {
    [K in RemoteApiName<Conn>]: {
        apiName: K,
        req: RemoteApi<Conn>[K]['req'],
        return: ApiReturn<RemoteApi<Conn>[K]['res']>,
        readonly conn: Conn
    }
}[RemoteApiName<Conn>];

export type ApiCallFlow<Conn extends BaseConnection> = {
    [K in LocalApiName<Conn>]: ApiCall<LocalApi<Conn>[K]['req'], LocalApi<Conn>[K]['res'], Conn>
}[LocalApiName<Conn>];

export type ApiCallReturnFlow<Conn extends BaseConnection> = {
    [K in LocalApiName<Conn>]: ApiCall<LocalApi<Conn>[K]['req'], LocalApi<Conn>[K]['res'], Conn> & {
        return: ApiReturn<LocalApi<Conn>[K]['res']>
    }
}[LocalApiName<Conn>];

export type MsgFlow<Conn extends BaseConnection> = {
    [K in MsgName<Conn>]: {
        msgName: K,
        msg: Conn['ServiceType']['msg'][K],
        readonly conn: Conn,
    }
}[MsgName<Conn>];

export type SendDataFlow<Conn extends BaseConnection> = {
    data: string | Uint8Array,
    readonly conn: Conn,
    /** Where the data is encoded from */
    readonly transportData: TransportData,
    /** If the data is an ApiReturn, this would be its original ApiCall. */
    readonly call?: ApiCallReturnFlow<Conn>,
};

export type RecvDataFlow<Conn extends BaseConnection> = {
    data: string | Uint8Array,
    /** If you want to customize the data decoding, set this in pre flow */
    decodedData?: TransportData
    readonly conn: Conn,
};