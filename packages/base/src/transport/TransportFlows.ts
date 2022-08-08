import { Flow } from "../models/Flow";
import { ApiCall } from "../proto/ApiCall";
import { ApiReturn } from "../proto/ApiReturn";
import { BaseTransport } from "./BaseTransport";

export interface TransportFlows<Conn extends BaseTransport<any>> {
    /**
     * API Client Flows (callApi)
     * callApi() 
     *   -> 【preCallApiFlow】
     *   -> send req
     *   -> recv res/err
     *   -> 【preCallApiReturnFlow】
     * -> return
     */
    preCallApiFlow: Flow<PreCallApiFlow<Conn>>,
    preCallApiReturnFlow: Flow<PreCallApiReturnFlow<Conn>>,

    /**
     * API Server Flows (ApiCall)
     * recv ApiCall
     *   -> 【preRecvReqFlow】
     *   -> execute API implementation
     *      -> call.succ() or call.error()
     *          -> 【prePreApiReturnFlow】
     *          -> send response
     *          -> 【postPreApiReturnFlow】
     */
    preApiCallFlow: Flow<PreApiCallFlow<Conn>>,
    preApiReturnFlow: Flow<PreApiReturnFlow<Conn>>,

    /**
     * Duplex Message Flows
     * sendMsg() -> 【preSendMsgFlow】 -> send data -> 【postSendMsgFlow】
     * recv MsgCall -> 【preRecvMsgFlow】 -> msg listeners
     */
    preSendMsgFlow: Flow<SendMsgFlowData<Conn>>,
    preRecvMsgFlow: Flow<RecvMsgFlowData<Conn>>,

    /**
     * Duplex TransportData Flows
     * sendTransportData() -> 【preSendTransportDataFlow】 -> send data
     * recv TransportData -> 【preRecvTransportDataFlow】 -> ApiCall or MsgCall or commands ...
     */
    // preSendDataFlow: Flow<TransportDataFlowData<Conn>>,
    // preRecvDataFlow: Flow<TransportDataFlowData<Conn>>,
}

export type PreCallApiFlow<Conn extends BaseTransport<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        apiName: K & string,
        req: Conn['ServiceType']['api'][K]['req'],
        ret?: ApiReturn<Conn['ServiceType']['api'][K]['res']>,
        readonly conn: Conn
    }
}[keyof Conn['ServiceType']['api']];

export type PreCallApiReturnFlow<Conn extends BaseTransport<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        apiName: K & string,
        req: Conn['ServiceType']['api'][K]['req'],
        ret: ApiReturn<Conn['ServiceType']['api'][K]['res']>,
        readonly conn: Conn
    }
}[keyof Conn['ServiceType']['api']];

export type PreApiCallFlow<Conn extends BaseTransport<any>> = {
    [K in keyof Conn['ServiceType']['api']]: ApiCall<Conn['ServiceType']['api'][K]['req'], Conn['ServiceType']['api'][K]['res'], Conn>
}[keyof Conn['ServiceType']['api']];

export type PreApiReturnFlow<Conn extends BaseTransport<any>> = {
    [K in keyof Conn['ServiceType']['api']]: {
        call: ApiCall<Conn['ServiceType']['api'][K]['req'], Conn['ServiceType']['api'][K]['res'], Conn> & {
            ret: ApiReturn<Conn['ServiceType']['api'][K]['res']>
            /** @deprecated Use `ret` instead */
            return: ApiReturn<Conn['ServiceType']['api'][K]['res']>
        },
        readonly conn: Conn,
    }
}[keyof Conn['ServiceType']['api']];

export type SendMsgFlowData<Conn extends BaseTransport<any>> = {
    [K in keyof Conn['ServiceType']['msg']]: {
        msgName: K & string,
        msg: Conn['ServiceType']['msg'][K],
        readonly conn: Conn,
    }
}[keyof Conn['ServiceType']['msg']];

export type RecvMsgFlowData<Conn extends BaseTransport<any>> = {
    [K in keyof Conn['ServiceType']['msg']]: {
        msgName: K & string,
        msg: Conn['ServiceType']['msg'][K],
        readonly conn: Conn,
    }
}[keyof Conn['ServiceType']['msg']];

// export type TransportDataFlowData<Conn extends BaseTransport<any>> = {
//     transportData: TransportData,
//     readonly conn: Conn,
// };