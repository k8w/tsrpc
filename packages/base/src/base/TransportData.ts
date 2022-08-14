import { ApiReturn } from "../proto/ApiReturn";
import { ProtoInfo } from "../proto/TransportDataSchema";

/**
 * Schema for binary serialize TransportData
 */
export type TransportData = {
    /** API Request */
    type: 'req',
    apiName: string,
    req: any,
    sn: number,
    /** Exchange proto info at first request */
    protoInfo?: ProtoInfo
} | {
    /** API Return */
    type: 'ret',
    sn: number,
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
    sn: number,
    /**
     * false | undefined: req (ping)
     * true: reply (pong)
     */
    isReply?: boolean
} | {
    /** Preserve for custom usage */
    type: 'custom',
    data: string | Uint8Array
};

export type TransportDataWithData = (
    Omit<TransportData & { type: 'req' }, 'req'>
    | Omit<TransportData & { type: 'ret' }, 'ret'>
    | Omit<TransportData & { type: 'msg' }, 'msg'>
    | Omit<TransportData & { type: 'custom' }, 'data'>
) & ({ dataType: 'text', data: string } | { dataType: 'buffer', data: Uint8Array });
export type SendableTransportData = TransportDataWithData | Exclude<TransportData, TransportData & { type: TransportDataWithData['type'] }>;