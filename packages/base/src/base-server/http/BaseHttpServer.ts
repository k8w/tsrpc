import { ApiReturn } from "../../proto/ApiReturn";
import { BaseServer, BaseServerOptions } from "../BaseServer";
import { BaseHttpServerConnection } from "./BaseHttpServerConnection";

export class BaseHttpServer<Conn extends BaseHttpServerConnection = any> extends BaseServer<Conn>{

    declare options: BaseHttpServerOptions;

    start(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    onConnection(conn: BaseHttpServerConnection) {
        super.onConnection(conn);

        // TODO
        // cors corsMaxAge
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

export interface PrivateBaseHttpServerOptions {
    transport: any;
}