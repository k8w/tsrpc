import { TsrpcError } from "tsrpc-proto";

export interface ApiReturnSucc<Res> {
    isSucc: true,
    res: Res,
    err?: undefined
}
export interface ApiReturnError {
    isSucc: false,
    res?: undefined,
    err: TsrpcError
}
export type ApiReturn<Res> = ApiReturnSucc<Res> | ApiReturnError;