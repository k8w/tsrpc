import { TsrpcError } from "../../proto/TsrpcError";

export type HttpRequestProxy = (options: {
    url: string,
    data: string | Uint8Array,
    method: string,
    /** ms */
    timeout?: number,
    headers?: {
        [key: string]: string,
    },
    responseType: 'text' | 'arraybuffer'
}) => {
    abort: () => void,
    promise: Promise<{ isSucc: true, body: string | Uint8Array, headers?: Record<string, string> } | { isSucc: false, err: TsrpcError }>
};