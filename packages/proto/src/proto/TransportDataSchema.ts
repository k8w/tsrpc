import { int, uint } from 'tsbuffer-schema';

/**
 * Schema for binary serialize TransportData
 */
export type TransportDataSchema = {
    /** API Request */
    type: 'req',
    /** Short connection don't need */
    sn?: uint,
    serviceId: uint,
    req: Uint8Array,
    /** Exchange proto info at first request */
    protoInfo?: ProtoInfo
} | {
    /** API Response */
    type: 'res',
    /** Short connection don't need */
    sn?: uint,
    res: Uint8Array,
    /** Exchange proto info if get a 'protoInfo' request header */
    protoInfo?: ProtoInfo,
} | {
    /** API Error */
    type: 'err',
    /** Short connection don't need */
    sn?: uint,
    err: TsrpcErrorData,
    /** Exchange proto info if get a 'protoInfo' request header */
    protoInfo?: ProtoInfo,
} | {
    /** Message */
    type: 'msg',
    serviceId: uint,
    msg: Uint8Array
} | {
    type: 'heartbeat',
    sn: uint
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

export interface ProtoInfo {
    lastModified: string,
    md5: string,
    tsrpcVersion: string,
    nodeVersion?: string
}

export interface TsrpcErrorData {
    message: string,
    /**
     * @defaultValue ApiError
     */
    type: TsrpcErrorType,
    code?: string | int,

    [key: string]: any
}

export enum TsrpcErrorType {
    /** Network error, like connection broken, network timeout, etc. */
    NetworkError = 'NetworkError',
    /** 
     * Server exception, for example "request format error", "database exception", etc.
     * 
     * @remarks
     * This error message may be not suitable to show to user,
     * but the error info is useful for engineer to find some bug.
     * So you can show a user-friendly message to user (like "System error, please contact XXX"),
     * and report some debug info at the same time.
     */
    ServerError = 'ServerError',
    /** Client exception, for example parse server output error. 
     * (May because of the proto file is not the same between server and client)
     */
    ClientError = 'ClientError',
    /**
     * The business error returned by `call.error`.
     * It is always business-relatived, for example `call.error('Password is incorrect')`, `call.error('Not enough credit')`, etc.
     */
    ApiError = 'ApiError',
}