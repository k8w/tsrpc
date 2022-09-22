import http, { IncomingMessage, ServerResponse } from "http";
import https from "https";
import { ApiReturn, BaseServiceType, ServiceProto, TsrpcError, TsrpcErrorType } from "tsrpc-base";
import { BaseServer, BaseServerOptions, PrivateBaseServerOptions } from "tsrpc-base-server";
import { HttpServerConnection } from "./HttpServerConnection";
import { HttpUtil } from "./models/HttpUtil";
import { TSRPC_VERSION } from "./models/version";

export class HttpServer<ServiceType extends BaseServiceType> extends BaseServer<HttpServerConnection<ServiceType>>{

    declare options: HttpServerOptions;

    constructor(serviceProto: ServiceProto, options: HttpServerOptions, privateOptions: PrivateHttpServerOptions) {
        super(serviceProto, options, privateOptions);
    }

    /** Native `http.Server` of NodeJS */
    httpServer?: http.Server | https.Server;

    protected async _start(): Promise<void> {
        this.logger.log(`Starting ${this.options.https ? 'HTTPS' : 'HTTP'} server at port ${this.options.port} ...`);

        if (this.options.https) {
            this.httpServer = https.createServer({ ...this.options.https }, this._onRequest.bind(this))
        }
        else {
            this.httpServer = http.createServer({}, this._onRequest.bind(this))
        }
    }

    protected _onRequest(req: IncomingMessage, res: ServerResponse) {
        res.statusCode = 200;
        res.setHeader('X-Powered-By', `TSRPC ${TSRPC_VERSION}`);

        // Create Connection
        const ip = HttpUtil.getClientIp(req);
        const conn = new HttpServerConnection(this, {
            // 默认 buffer，收完数据后，preRecvDataFlow 后根据 header 解析
            dataType: 'buffer',
            httpReq: req,
            httpRes: res,
            ip: ip,
            logPrefixs: [this.chalk(`[${ip}]`, ['gray'])]
        });
        this.onConnection(conn);

        // Wait data
        let chunks: Buffer[] = [];
        req.on('data', data => {
            chunks.push(data);
        });
        req.on('end', async () => {
            // conn.dataType: Text or Buffer?
            const contentType = req.headers['content-type']?.toLowerCase() ?? '';
            if (contentType.indexOf('application/json') > -1) {
                conn.dataType = 'text';
                if (!this.options.json) {
                    conn['_sendTransportData']({
                        type: 'err',
                        err: new TsrpcError('The server has disabled JSON, please use binary instead.', { type: TsrpcErrorType.RemoteError }),
                        sn: 0,
                        protoInfo: this.localProtoInfo
                    })
                    return;
                }
            }

            const buf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
            const data = conn.dataType === 'buffer' ? buf : buf.toString();

            // Pre Flow

            // ----------------------------------------------


            let isJSON = this.options.jsonEnabled && req.headers["content-type"]?.toLowerCase().includes('application/json')
                && req.method === 'POST' && req.url?.startsWith(this.options.jsonHostPath);
            conn = new HttpConnection({
                server: this,
                id: '' + this._connIdCounter.getNext(),
                ip: ip,
                req: req,
                httpRes: httpRes,
                dataType: isJSON ? 'text' : 'buffer'
            });
            await this.flows.postConnectFlow.exec(conn, conn.logger);



            if (conn.dataType === 'text') {
                let url = conn.req.url!;

                let urlEndPos = url.indexOf('?');
                let isMsg: boolean = false;
                if (urlEndPos > -1) {
                    isMsg = url.slice(urlEndPos + 1).split('&').some(v => v === 'type=msg');
                    url = url.slice(0, urlEndPos);
                }

                // Parse serviceId
                let serviceName = url.slice(this.options.jsonHostPath.length);
                let serviceId: number | undefined;
                if (isMsg) {
                    serviceId = this.serviceMap.msgName2Service[serviceName]?.id;
                }
                else {
                    serviceId = this.serviceMap.apiName2Service[serviceName]?.id
                }

                const data = buf.toString();
                if (serviceId === undefined) {
                    this.onInputDataError(`Invalid ${isMsg ? 'msg' : 'api'} path: ${serviceName}`, conn, data)
                    return;
                }
                this._onRecvData(conn, data, serviceId);
            }
            else {
                this._onRecvData(conn, buf);
            }
        });

        // 处理连接异常关闭的情况
        httpRes.on('close', async () => {
            // 客户端Abort
            if (httpReq.aborted) {
                if (conn) {
                    if (conn.call) {
                        conn.call.logger.log('[ReqAborted]');
                    }
                    else {
                        conn.logger.log('[ReqAborted]');
                    }
                }
                else {
                    this.logger.log('[ReqAborted]', {
                        url: httpReq.url,
                        method: httpReq.method,
                        ip: ip,
                        chunksLength: chunks.length,
                        chunksSize: chunks.sum(v => v.byteLength),
                        reqComplete: httpReq.complete,
                        headers: httpReq.rawHeaders
                    });
                }
            }
            // 非Abort，异常中断：直到连接关闭，Client也未end（Conn未生成）
            else if (!conn) {
                this.logger.warn('Socket closed before request end', {
                    url: httpReq.url,
                    method: httpReq.method,
                    ip: ip,
                    chunksLength: chunks.length,
                    chunksSize: chunks.sum(v => v.byteLength),
                    reqComplete: httpReq.complete,
                    headers: httpReq.rawHeaders
                });
            }
            // 有Conn，但连接非正常end：直到连接关闭，也未调用过 httpRes.end 方法
            else if (!httpRes.writableEnded) {
                (conn.call?.logger || conn.logger).warn('Socket closed without response')
            }

            // Post Flow
            if (conn) {
                await this.flows.postDisconnectFlow.exec({ conn: conn }, conn.logger)
            }
        });
    }

    onConnection(conn: Conn) {
        super.onConnection(conn);
        // TODO if closed

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

    // TODO
    inputJSON(apiName: string, req: object, sourceIp?: string) { }
    inputBuffer(buf: Uint8Array, sourceIp?: string) { }

}

export interface HttpServerOptions extends BaseServerOptions {
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
        key: https.ServerOptions['key'],

        /**
         * @example
         * fs.readFileSync('xxx-cert.pem');
         */
        cert: https.ServerOptions['cert']
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

export interface PrivateHttpServerOptions extends PrivateBaseServerOptions {
    transport: any;
}