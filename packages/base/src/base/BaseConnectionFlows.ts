import { Flow } from "../models/Flow";
import { ApiReturn } from "../proto/ApiReturn";
import { BaseServiceType } from "../proto/BaseServiceType";
import { ApiCall } from "./ApiCall";
import { BaseConnection } from "./BaseConnection";
import { TransportData } from "./TransportData";

export interface BaseConnectionFlows<Conn extends BaseConnection, ServiceType extends Conn['ServiceType']> {

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
    preCallApiFlow: Flow<CallApiFlow<Conn, ServiceType>>,
    preCallApiReturnFlow: Flow<CallApiReturnFlow<Conn, ServiceType>>,

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
    preApiCallFlow: Flow<ApiCallFlow<Conn, ServiceType>>,
    preApiCallReturnFlow: Flow<ApiCallReturnFlow<Conn, ServiceType>>,

    /**
     * Duplex Message Flows
     * sendMsg() -> 【preSendMsgFlow】 -> send data -> 【postSendMsgFlow】
     * recv MsgCall -> 【preRecvMsgFlow】 -> msg listeners
     */
    preSendMsgFlow: Flow<MsgFlow<Conn, ServiceType>>,
    preRecvMsgFlow: Flow<MsgFlow<Conn, ServiceType>>,

    /**
     * Duplex TransportData Flows
     * sendTransportData() -> 【preSendTransportDataFlow】 -> send data
     * recv TransportData -> 【preRecvTransportDataFlow】 -> ApiCall or MsgCall or commands ...
     */
    preSendDataFlow: Flow<SendDataFlow<Conn, ServiceType>>,
    postSendDataFlow: Flow<SendDataFlow<Conn, ServiceType>>,
    preRecvDataFlow: Flow<RecvDataFlow<Conn>>,
    // postRecvCustomDataFlow: Flow<RecvCustomDataFlow<Conn>>,
}

export type CallApiFlow<Conn extends BaseConnection<any>, ServiceType extends BaseServiceType> = {
    [K in keyof ServiceType['api']]: {
        apiName: K & string,
        req: ServiceType['api'][K]['req'],
        ret?: ApiReturn<ServiceType['api'][K]['res']>,
        readonly conn: Conn
    }
}[keyof ServiceType['api']];

export type CallApiReturnFlow<Conn extends BaseConnection<any>, ServiceType extends BaseServiceType> = {
    [K in keyof ServiceType['api']]: {
        apiName: K & string,
        req: ServiceType['api'][K]['req'],
        return: ApiReturn<ServiceType['api'][K]['res']>,
        readonly conn: Conn
    }
}[keyof ServiceType['api']];

export type ApiCallFlow<Conn extends BaseConnection<any>, ServiceType extends BaseServiceType> = {
    [K in keyof ServiceType['api']]: ApiCall<ServiceType['api'][K]['req'], ServiceType['api'][K]['res'], Conn>
}[keyof ServiceType['api']];

export type ApiCallReturnFlow<Conn extends BaseConnection<any>, ServiceType extends BaseServiceType> = {
    [K in keyof ServiceType['api']]: ApiCall<ServiceType['api'][K]['req'], ServiceType['api'][K]['res'], Conn> & {
        return: ApiReturn<ServiceType['api'][K]['res']>
    }
}[keyof ServiceType['api']];

export type MsgFlow<Conn extends BaseConnection<any>, ServiceType extends BaseServiceType> = {
    [K in keyof ServiceType['msg']]: {
        msgName: K & string,
        msg: ServiceType['msg'][K],
        readonly conn: Conn,
    }
}[keyof ServiceType['msg']];

export type SendDataFlow<Conn extends BaseConnection<any>, ServiceType extends BaseServiceType> = {
    data: string | Uint8Array,
    readonly conn: Conn,
    /** Where the data is encoded from */
    readonly transportData: TransportData,
    /** If the data is an ApiReturn, this would be its original ApiCall. */
    readonly call?: ApiCallReturnFlow<Conn, ServiceType>,
};

export type RecvDataFlow<Conn extends BaseConnection<any>> = {
    data: string | Uint8Array,
    /** If you want to customize the data decoding, set this in pre flow */
    decodedData?: TransportData
    readonly conn: Conn,
};

// export type RecvCustomDataFlow<Conn extends BaseConnection<any>> = {
//     data: TransportData & { type: 'custom' },
//     readonly conn: Conn,
// };