import { TsrpcError } from "../proto/TsrpcError";

export type OpResult<T> = { isSucc: true, res: T } | { isSucc: false, err: TsrpcError };