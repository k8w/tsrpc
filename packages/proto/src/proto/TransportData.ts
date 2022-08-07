import { ApiReturn } from "./ApiReturn";
import { ProtoInfo } from "./TransportDataSchema";

/**
 * Schema for binary serialize TransportData
 */
export type TransportData = {
    /** API Request */
    type: 'req',
    /** Short connection don't need */
    sn?: number,
    apiName: string,
    req: any,
    /** Exchange proto info at first request */
    protoInfo?: ProtoInfo
} | {
    /** API Return */
    type: 'ret',
    /** Short connection don't need */
    sn?: number,
    ret: ApiReturn<any>,
    /** Exchange proto info if get a 'protoInfo' request header */
    protoInfo?: ProtoInfo,
} | {
    /** Message */
    type: 'msg',
    msgName: string,
    msg: any
} | {
    type: 'heartbeat',
    sn: number
} | {
    /** First connection, exchange some info */
    type: 'connect',
    header?: {
        protoInfo: ProtoInfo,
        [key: string]: any
    }
} | {
    /** Preserve for custom usage */
    type: 'custom',
    [key: string]: any
};