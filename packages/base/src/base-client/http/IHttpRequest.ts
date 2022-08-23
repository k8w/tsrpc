import { TsrpcError } from "../../proto/TsrpcError";

export type HttpRequest = (options: {
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
    promise: Promise<{ isSucc: true, res: string | Uint8Array } | { isSucc: false, err: TsrpcError }>
};