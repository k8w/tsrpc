import { TsrpcError } from "../proto/TsrpcError";

export type OpResult<T> = (T extends void ? { isSucc: true } : { isSucc: true, res: T }) | { isSucc: false, err: TsrpcError };