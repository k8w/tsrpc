import { ProtoInfo } from "./TransportDataSchema";

/**
 * Schema for binary serialize TransportData
 */
export type TransportData<DataType> = {
    /** API Request */
    type: 'req',
    apiName: string,
    sn: number,
    data: DataType,
    /** Exchange proto info at first request */
    protoInfo?: ProtoInfo
} | {
    /** API Return */
    type: 'ret',
    sn: number,
    data: DataType,
    /** Exchange proto info if get a 'protoInfo' request header */
    protoInfo?: ProtoInfo,
} | {
    /** Message */
    type: 'msg',
    msgName: string,
    data: DataType
} | {
    type: 'heartbeat',
    sn: number
} | {
    /** Preserve for custom usage */
    type: 'custom',
    [key: string]: any
};