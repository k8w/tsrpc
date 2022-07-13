import { int, uint } from 'tsbuffer-schema';

/**
 * Basic transport data unit,
 * which represents data that server received, which should be sent by `client.callApi` or `client.sendMsg`.
 */
export interface ServerInputData {
    serviceId: uint,
    buffer: Uint8Array,

    /** Short link don't need this */
    sn?: uint
}
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