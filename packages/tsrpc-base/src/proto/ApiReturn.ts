import { TsrpcError } from "./TsrpcError";

/**
 * Successful by `call.succ()`
 */
export interface ApiReturnSucc<Res> {
    isSucc: true,
    res: Res,
    err?: undefined
}
/**
 * Unified error, include network error, business error, code exception etc.
 */
export interface ApiReturnError {
    isSucc: false,
    res?: undefined,
    err: TsrpcError
}

/**
 * The return of `client.callApi()`
 */
export type ApiReturn<Res> = ApiReturnSucc<Res> | ApiReturnError;