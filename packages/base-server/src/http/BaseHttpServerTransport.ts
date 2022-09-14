import { OpResultVoid } from "../../models/OpResult";

export interface BaseHttpServerTransport {

    start(onRequest: (httpReq: HttpReq, httpRes: HttpRes) => void): Promise<OpResultVoid>;

    stop(): Promise<OpResultVoid>;

}

export interface HttpReq {
    method: string,
    url: string,
    headers: Record<string, string | undefined>,
    body: Uint8Array | string,
    ip: string,

    /** Native NodeJS http.IncomingMessage */
    _nativeReq?: unknown
}

export interface HttpRes {
    setStatusCode(statusCode: number): void,
    setHeader(key: string, value: string | null): void,
    end(data?: Uint8Array | string): Promise<OpResultVoid>,

    /** Native NodeJS http.ServerResponse */
    _nativeRes?: unknown
}