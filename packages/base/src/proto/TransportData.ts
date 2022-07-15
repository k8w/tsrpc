import { int, uint } from 'tsbuffer-schema';

/**
 * Basic transport data unit,
 * which represents data that sended by server/client.
 */
export type TransportData = {
    /** API Request */
    type: 'ApiReq',
    sn: uint,
    serviceId: uint,
    data: Uint8Array,
    header?: {
        queryProtoInfo?: boolean,
        queryServerInfo?: boolean,
        [key: string]: any
    }
} | {
    /** API Response */
    type: 'ApiRes',
    sn: uint,
    data: Uint8Array,
    header?: {
        protoInfo?: {
            version: uint,
            md5: string
        },
        serverInfo?: {
            tsrpcVersion: string,
            nodeVersion: string
        },
        [key: string]: any
    }
} | {
    /** API Error */
    type: 'ApiErr',
    sn: uint,
    error: TsrpcErrorData,
    header?: {
        [key: string]: any
    }
} | {
    /** Message */
    type: 'Msg',
    serviceId: uint,
    data: Uint8Array,
    header?: {
        [key: string]: any
    }
} | {
    type: 'Heartbeat',
    sn: uint
}

/**
 * TSRPC Control Command
 */
export type ControlCommand = {
    // Query ServiceProto Information
    type: 'ServiceProtoInfo',
    req: {},
    res: {
        version: string,
        md5: string
    }
};

/**
 * Basic transport data unit,
 * which represents data that server sent by `call.succ` or `call.error` or `conn.sendMsg`.
 */
export interface ServerOutputData {
    /** ApiResponse or Msg */
    buffer?: Uint8Array,
    /** Api Error, cannot exists at the same time with `buffer` */
    error?: TsrpcErrorData,

    /** Short link apiRes don't need this */
    serviceId?: uint,
    /** Short link don't need this */
    sn?: uint
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