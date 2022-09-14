import { ServiceProto, ApiReturn } from "tsrpc-base";
import { BaseServer, BaseServerOptions, PrivateBaseServerOptions } from "../base/BaseServer";
import { BaseHttpServerConnection } from "./BaseHttpServerConnection";

export class BaseHttpServer<Conn extends BaseHttpServerConnection = any> extends BaseServer<Conn>{

    declare options: BaseHttpServerOptions;

    constructor(serviceProto: ServiceProto, options: BaseHttpServerOptions, privateOptions: PrivateBaseHttpServerOptions) {
        super(serviceProto, options, privateOptions);
    }

    start(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    onConnection(conn: Conn) {
        super.onConnection(conn);
        const httpReq = conn.httpReq;
        const httpRes = conn.httpRes;

        httpRes.setStatusCode(200);
        httpRes.setHeader('X-Powered-By', this.localProtoInfo.tsrpc);

        // CORS
        if (this.options.cors) {
            httpRes.setHeader('Access-Control-Allow-Origin', this.options.cors);
            httpRes.setHeader('Access-Control-Allow-Headers', 'Content-Type,*');
            if (this.options.corsMaxAge) {
                httpRes.setHeader('Access-Control-Max-Age', '' + this.options.corsMaxAge);
            }
            if (httpReq.method === 'OPTIONS') {
                httpRes.setStatusCode(200);
                httpRes.end();
                return;
            }
        }

        // TODO
        // socketTimeout keepAliveTimeout
    }

    protected _stop(): void {
        throw new Error("Method not implemented.");
    }

}

export interface BaseHttpServerOptions extends BaseServerOptions {
    /** Which port the HTTP server listen to */
    port: number,

    /**
     * ★ ONLY FOR WHEN `{dataType: 'text'}` ★
     * Actual URL path is `${hostPath}/${apiName}`.
     * For example, if `hostPath` is `'/api'`, then you can send `POST /api/a/b/c/Test` to call API `a/b/c/Test`.
     * @defaultValue `'/'`
     */
    hostPath: string,

    /**
     * HTTPS options, the server would use https instead of http if this value is defined.
     * NOTICE: Once you enabled https, you CANNOT visit the server via `http://` anymore.
     * If you need visit the server via both `http://` and `https://`, you can start 2 HttpServer (one with `https` and another without).
     * @defaultValue `undefined`
     */
    https?: {
        /**
         * @example
         * fs.readFileSync('xxx-key.pem');
         */
        key: string | Uint8Array,

        /**
         * @example
         * fs.readFileSync('xxx-cert.pem');
         */
        cert: string | Uint8Array
    },

    /** 
     * Passed to the `timeout` property to the native `http.Server` of NodeJS, in milliseconds.
     * `0` and `undefined` will disable the socket timeout behavior.
     * NOTICE: this `socketTimeout` be `undefined` only means disabling of the socket timeout, the `apiTimeout` is still working.
     * `socketTimeout` should always greater than `apiTimeout`.
     * @defaultValue `undefined`
     * @see {@link https://nodejs.org/dist/latest-v14.x/docs/api/http.html#http_server_timeout}
     */
    socketTimeout?: number,

    /**
     * Passed to the `keepAliveTimeout` property to the native `http.Server` of NodeJS, in milliseconds.
     * It means keep-alive timeout of HTTP socket connection.
     * @defaultValue 5000 (from NodeJS)
     * @see {@link https://nodejs.org/dist/latest-v14.x/docs/api/http.html#http_server_keepalivetimeout}
     */
    keepAliveTimeout?: number,

    /** 
     * Response header value of `Access-Control-Allow-Origin`.
     * If this has any value, it would also set `Access-Control-Allow-Headers` as `*`.
     * `undefined` means no CORS header.
     * @defaultValue `*`
     */
    cors?: string,

    /**
     * Response header value of `Access-Control-Allow-Origin`.
     * @defaultValue `3600`
     */
    corsMaxAge?: number,

    encodeReturnText?: (ret: ApiReturn<any>) => string,

    // Deprecated
    /** @deprecated Use `hostPath` instead */
    jsonHostPath?: never,
}

export interface PrivateBaseHttpServerOptions extends PrivateBaseServerOptions {
    transport: any;
}