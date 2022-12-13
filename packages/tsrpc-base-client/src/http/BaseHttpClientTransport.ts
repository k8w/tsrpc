import { TsrpcError } from "tsrpc-base";

export interface BaseHttpClientTransport {
    request: (options: RequestOptions) => RequestReturn
}

export interface RequestOptions {
    url: string,
    data: string | Uint8Array,
    method: string,
    /** ms */
    timeout?: number,
    headers?: {
        [key: string]: string,
    },
    responseType: 'text' | 'arraybuffer'
}

export type RequestReturn = {
    abort: () => void,
    promise: Promise<
        /** Successful: got response from the server */
        {
            isSucc: true,
            body: string | Uint8Array,
            headers?: {
                'x-tsrpc-proto-info'?: string
            },
            statusCode: number
        }
        /** Failed: Network error, request not sent */
        | {
            isSucc: false,
            err: TsrpcError
        }
    >
};