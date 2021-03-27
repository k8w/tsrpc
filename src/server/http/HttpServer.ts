import * as http from "http";
import { BaseServiceType } from 'tsrpc-proto';
import { tsrpcVersion } from '../../../tsrpcVersion';
import { Counter } from '../../models/Counter';
import { HttpUtil } from '../../models/HttpUtil';
import { Pool } from '../../models/Pool';
import { ParsedServerInput } from '../../models/TransportDataUtil';
import { BaseServer, BaseServerOptions, defualtBaseServerOptions } from '../base/BaseServer';
import { ApiCallHttp, HttpCall, MsgCallHttp } from './HttpCall';
import { HttpConnection } from './HttpConnection';

export class HttpServer<ServiceType extends BaseServiceType = any> extends BaseServer<HttpServerOptions<ServiceType>, ServiceType>{

    protected _poolApiCall: Pool<ApiCallHttp>;
    protected _poolMsgCall: Pool<MsgCallHttp>;
    protected _poolConn: Pool<HttpConnection<any>>;

    get dataFlow(): ((data: Buffer, conn: HttpConnection<any>) => (boolean | Promise<boolean>))[] {
        return this._dataFlow;
    };

    private _apiSnCounter = new Counter(1);

    constructor(options?: Partial<HttpServerOptions<ServiceType>>) {
        super(Object.assign({}, defaultHttpServerOptions, options));
        this._poolApiCall = new Pool<ApiCallHttp>(ApiCallHttp, this.options.enablePool);
        this._poolMsgCall = new Pool<MsgCallHttp>(MsgCallHttp, this.options.enablePool);
        this._poolConn = new Pool<HttpConnection<any>>(HttpConnection, this.options.enablePool);
    }

    private _status: HttpServerStatus = 'closed';
    public get status(): HttpServerStatus {
        return this._status;
    }

    private _server?: http.Server;
    start(): Promise<void> {
        if (this._server) {
            throw new Error('Server already started');
        }

        return new Promise(rs => {
            this._status = 'opening';
            this.logger.log(`Starting HTTP server ...`);
            this._server = http.createServer((httpReq, httpRes) => {
                let ip = HttpUtil.getClientIp(httpReq);

                httpRes.statusCode = 200;
                httpRes.setHeader('X-Powered-By', `TSRPC ${tsrpcVersion}`);
                if (this.options.cors) {
                    httpRes.setHeader('Access-Control-Allow-Origin', this.options.cors)
                };

                let chunks: Buffer[] = [];
                httpReq.on('data', data => {
                    chunks.push(data);
                });

                let conn: HttpConnection<any> | undefined;
                httpReq.on('end', () => {
                    conn = this._poolConn.get({
                        server: this,
                        ip: ip,
                        httpReq: httpReq,
                        httpRes: httpRes
                    });

                    let buf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
                    this.onData(conn, buf);
                });

                // 处理连接异常关闭的情况
                httpRes.on('close', () => {
                    // 客户端Abort
                    if (httpReq.aborted) {
                        if (conn) {
                            if (conn.options.call) {
                                conn.options.call.logger.log('[Aborted]');
                            }
                            else {
                                conn.logger.log('[Aborted]');
                            }
                        }
                        else {
                            this.logger.log('[RequestAborted]', {
                                url: httpReq.url,
                                method: httpReq.method,
                                ip: ip,
                                chunksLength: chunks.length,
                                chunksSize: chunks.sum(v => v.byteLength),
                                reqComplete: httpReq.complete,
                                headers: httpReq.rawHeaders
                            });
                        }
                        return;
                    }

                    // 非Abort，异常中断：直到连接关闭，Client也未end（Conn未生成）
                    if (!conn) {
                        this.logger.warn('Socket closed before request end', {
                            url: httpReq.url,
                            method: httpReq.method,
                            ip: ip,
                            chunksLength: chunks.length,
                            chunksSize: chunks.sum(v => v.byteLength),
                            reqComplete: httpReq.complete,
                            headers: httpReq.rawHeaders
                        });
                        return;
                    }

                    // 有Conn，但连接非正常end：直到连接关闭，也未调用过 httpRes.end 方法
                    if (!httpRes.writableEnded) {
                        (conn.options.call?.logger || conn.logger).warn('Socket closed without response')
                    }
                });
            });

            if (this.options.socketTimeout) {
                this._server.timeout = this.options.socketTimeout;
            }

            this._server.listen(this.options.port, () => {
                this._status = 'open';
                this.logger.log(`Server started at ${this.options.port}`);
                rs();
            })
        });
    }

    stop(): Promise<void> {
        return new Promise((rs, rj) => {
            if (!this._server) {
                rs();
                return;
            }
            this._status = 'closing';

            // 立即close，不再接受新请求
            // 等所有连接都断开后rs
            this._server.close(err => {
                if (err) {
                    rj(err)
                }
                else {
                    this.logger.log('Server stopped');
                    rs();
                }
            });

            this._server = undefined;
        })
    }

    protected _parseBuffer(conn: HttpConnection<ServiceType>, buf: Uint8Array): ParsedServerInput {
        let parsed: ParsedServerInput = super._parseBuffer(conn, buf);

        if (parsed.type === 'api') {
            parsed.sn = this._apiSnCounter.getNext();
        }
        else if (parsed.type === 'msg') {
            conn.close();
        }
        return parsed;
    }

    // HTTP Server 一个conn只有一个call，对应关联之
    protected _makeCall(conn: HttpConnection<any>, input: ParsedServerInput): HttpCall {
        let call = super._makeCall(conn, input) as HttpCall;
        conn.options.call = call;
        return call;
    }

    // Override function type
    implementApi!: <T extends keyof ServiceType['req']>(apiName: T, handler: ApiHandlerHttp<ServiceType['req'][T], ServiceType['res'][T], ServiceType>) => void;
    listenMsg!: <T extends keyof ServiceType['msg']>(msgName: T, handler: MsgHandlerHttp<ServiceType['msg'][T], ServiceType>) => void;
}

export const defaultHttpServerOptions: HttpServerOptions<any> = {
    ...defualtBaseServerOptions,
    port: 3000
}

export interface HttpServerOptions<ServiceType extends BaseServiceType> extends BaseServerOptions {
    port: number,
    socketTimeout?: number,
    cors?: string,

    /**
     * 是否启用 JSON
     * 启用后可兼容 http JSON 方式的调用，具体方法为：
     * 1. Header 加入：`Content-type: application/json`
     * 2. POST /{jsonUrlPath}/a/b/c/Test
     * 3. body 为 JSON
     * 4. 返回亦为JSON
     * 默认为 `false`
     */
    jsonEnabled: boolean,
    /**
     * 默认为 `'/'`
     */
    jsonUrlPath: string,
    /**
     * 是否剔除协议中未定义的多余字段
     * 默认为 `true`
     */
    jsonPrune: boolean
}

type HttpServerStatus = 'opening' | 'open' | 'closing' | 'closed';

export type ApiHandlerHttp<Req, Res, ServiceType extends BaseServiceType = any> = (call: ApiCallHttp<Req, Res, ServiceType>) => void | Promise<void>;
export type MsgHandlerHttp<Msg, ServiceType extends BaseServiceType = any> = (msg: MsgCallHttp<Msg, ServiceType>) => void | Promise<void>;