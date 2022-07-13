import * as http from "http";
import https from "https";
import { BaseServiceType, ServiceProto } from 'tsrpc-proto';
import { HttpUtil } from '../../models/HttpUtil';
import { TSRPC_VERSION } from "../../models/version";
import { BaseServer, BaseServerOptions, defaultBaseServerOptions, ServerStatus } from '../base/BaseServer';
import { HttpConnection } from './HttpConnection';

/**
 * TSRPC Server, based on HTTP connection.
 * @typeParam ServiceType - `ServiceType` from generated `proto.ts`
 */
export class HttpServer<ServiceType extends BaseServiceType = any> extends BaseServer<ServiceType>{
    readonly options!: HttpServerOptions<ServiceType>;

    constructor(proto: ServiceProto<ServiceType>, options?: Partial<HttpServerOptions<ServiceType>>) {
        super(proto, {
            ...defaultHttpServerOptions,
            ...options
        });

        // 确保 jsonHostPath 以 / 开头和结尾
        this.options.jsonHostPath = this.options.jsonHostPath ?
            (this.options.jsonHostPath.startsWith('/') ? '' : '/') + this.options.jsonHostPath + (this.options.jsonHostPath.endsWith('/') ? '' : '/')
            : '/';
    }

    /** Native `http.Server` of NodeJS */
    httpServer?: http.Server | https.Server;
    /**
     * {@inheritDoc BaseServer.start}
     */
    start(): Promise<void> {
        if (this.httpServer) {
            throw new Error('Server already started');
        }

        return new Promise(rs => {
            this._status = ServerStatus.Opening;
            this.logger.log(`Starting ${this.options.https ? 'HTTPS' : 'HTTP'} server ...`);
            this.httpServer = (this.options.https ? https : http).createServer({
                ...this.options.https
            }, (httpReq, httpRes) => {
                if (this.status !== ServerStatus.Opened) {
                    httpRes.statusCode = 503;
                    httpRes.end();
                    return;
                }

                let ip = HttpUtil.getClientIp(httpReq);

                httpRes.statusCode = 200;
                httpRes.setHeader('X-Powered-By', `TSRPC ${TSRPC_VERSION}`);
                if (this.options.cors) {
                    httpRes.setHeader('Access-Control-Allow-Origin', this.options.cors);
                    httpRes.setHeader('Access-Control-Allow-Headers', 'Content-Type,*');
                    if (this.options.corsMaxAge) {
                        httpRes.setHeader('Access-Control-Max-Age', '' + this.options.corsMaxAge);
                    }
                    if (httpReq.method === 'OPTIONS') {
                        httpRes.writeHead(200);
                        httpRes.end();
                        return;
                    }
                };

                let chunks: Buffer[] = [];
                httpReq.on('data', data => {
                    chunks.push(data);
                });

                let conn: HttpConnection<ServiceType> | undefined;
                httpReq.on('end', async () => {
                    let isJSON = this.options.jsonEnabled && httpReq.headers["content-type"]?.toLowerCase().includes('application/json')
                        && httpReq.method === 'POST' && httpReq.url?.startsWith(this.options.jsonHostPath);
                    conn = new HttpConnection({
                        server: this,
                        id: '' + this._connIdCounter.getNext(),
                        ip: ip,
                        httpReq: httpReq,
                        httpRes: httpRes,
                        dataType: isJSON ? 'text' : 'buffer'
                    });
                    await this.flows.postConnectFlow.exec(conn, conn.logger);

                    let buf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);

                    if (conn.dataType === 'text') {
                        let url = conn.httpReq.url!;

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
            });

            if (this.options.socketTimeout) {
                this.httpServer.timeout = this.options.socketTimeout;
            }
            if (this.options.keepAliveTimeout) {
                this.httpServer.keepAliveTimeout = this.options.keepAliveTimeout;
            }

            this.httpServer.listen(this.options.port, () => {
                this._status = ServerStatus.Opened;
                this.logger.log(`Server started at ${this.options.port}.`);
                rs();
            })
        });
    }

    /**
     * {@inheritDoc BaseServer.stop}
     */
    async stop(): Promise<void> {
        if (!this.httpServer) {
            return;
        }
        this.logger.log('Stopping server...');

        return new Promise<void>((rs) => {
            this._status = ServerStatus.Closing;

            // 立即close，不再接受新请求
            // 等所有连接都断开后rs
            this.httpServer?.close(err => {
                this._status = ServerStatus.Closed;
                this.httpServer = undefined;

                if (err) {
                    this.logger.error(err);
                }
                this.logger.log('Server stopped');
                rs();
            });
        })

    }
}

export interface HttpServerOptions<ServiceType extends BaseServiceType> extends BaseServerOptions<ServiceType> {
    /** Which port the HTTP server listen to */
    port: number,

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

    /**
     * Actual URL path is `${jsonHostPath}/${apiName}`.
     * For example, if `jsonHostPath` is `'/api'`, then you can send `POST /api/a/b/c/Test` to call API `a/b/c/Test`.
     * @defaultValue `'/'`
     */
    jsonHostPath: string
}

export const defaultHttpServerOptions: HttpServerOptions<any> = {
    ...defaultBaseServerOptions,
    port: 3000,
    cors: '*',
    corsMaxAge: 3600,
    jsonHostPath: '/',

    // TODO: keep-alive time (to SLB)
}