import { int, uint } from 'tsbuffer-schema';

/**
 * Schema for binary serialize TransportData
 */
export type TransportDataSchema = {
    /** API Request */
    type: 'req',
    body: Uint8Array,
    serviceId: uint,
    sn: uint,
    /** Exchange proto info at first request */
    protoInfo?: ProtoInfo
} | {
    /** API Return */
    type: 'res',
    body: Uint8Array,
    sn: uint,
    /** Exchange proto info if get a 'protoInfo' request header */
    protoInfo?: ProtoInfo
} | {
    /** API Return */
    type: 'err',
    err: TsrpcErrorData,
    sn: uint,
    /** Exchange proto info if get a 'protoInfo' request header */
    protoInfo?: ProtoInfo,
} | {
    /** Message */
    type: 'msg',
    body: Uint8Array,
    serviceId: uint,
} | {
    type: 'heartbeat',
    sn: uint,
    /**
     * false | undefined: req (ping)
     * true: reply (pong)
     */
    isReply?: boolean
} | {
    /** Preserve for custom usage */
    type: 'custom',
    [key: string]: any
};

export interface ProtoInfo {
    lastModified: string,
    md5: string,
    /** @example "tsrpc-browser@4.1.0" */
    tsrpc: string,
    node?: string
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
     * Remote exception, for example "request format error", "database exception", etc.
     * 
     * @remarks
     * This error message may be not suitable to show to user,
     * but the error info is useful for engineer to find some bug.
     * So you can show a user-friendly message to user (like "System error, please contact XXX"),
     * and report some debug info at the same time.
     */
    RemoteError = 'RemoteError',
    /** Local exception, for example parse server output error. 
     * (May because of the proto file is not the same between server and client)
     */
    LocalError = 'LocalError',
    /**
     * The business error returned by `call.error`.
     * It is always business-relatived, for example `call.error('Password is incorrect')`, `call.error('Not enough credit')`, etc.
     */
    ApiError = 'ApiError',

    /** @deprecated Use 'RemoteError' instead */
    ServerError = 'RemoteError',
    /** @deprecated Use 'LocalError' instead */
    ClientError = 'LocalError',
}