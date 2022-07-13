import { ApiReturn, BaseServiceType } from "tsrpc-proto";
import { TransportOptions } from "./TransportOptions";

export type CallApiFlowData<ServiceType extends BaseServiceType> = {
    [K in keyof ServiceType['api']]: {
        apiName: K & string,
        req: ServiceType['api'][K]['req'],
        options?: TransportOptions,
        // promise: SuperPromise<ServiceType['api'][K]['res']>,
        return?: ApiReturn<ServiceType['api'][K]['res']>
    }
}[keyof ServiceType['api']];
export type ApiReturnFlowData<ServiceType extends BaseServiceType> = {
    [K in keyof ServiceType['api']]: {
        apiName: K & string,
        req: ServiceType['api'][K]['req'],
        options?: TransportOptions,
        // promise: SuperPromise<ServiceType['api'][K]['res']>,
        return: ApiReturn<ServiceType['api'][K]['res']>
    }
}[keyof ServiceType['api']];

export type SendMsgFlowData<ServiceType extends BaseServiceType> = {
    [K in keyof ServiceType['msg']]: {
        msgName: K & string,
        msg: ServiceType['msg'][K],
        options?: TransportOptions
    }
}[keyof ServiceType['msg']];
export type RecvMsgFlowData<ServiceType extends BaseServiceType> = {
    [K in keyof ServiceType['msg']]: {
        msgName: K & string,
        msg: ServiceType['msg'][K]
    }
}[keyof ServiceType['msg']];