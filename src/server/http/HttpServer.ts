import * as http from "http";
import { BaseServiceType, ServiceProto } from 'tsrpc-proto';
import { TSRPC_VERSION } from "../..";
import { Counter } from '../../models/Counter';
import { HttpUtil } from '../../models/HttpUtil';
import { Pool } from '../../models/Pool';
import { ParsedServerInput } from '../../models/TransportDataUtil';
import { ApiCallOptions, ApiCall } from "../base/ApiCall";
import { BaseServer, BaseServerOptions, defaultBaseServerOptions } from '../base/BaseServer';
import { MsgCallOptions, MsgCall } from "../base/MsgCall";
import { ApiCallHttp } from './ApiCallHttp';
import { HttpConnection } from './HttpConnection';
import { MsgCallHttp } from "./MsgCallHttp";

export class HttpServer<ServiceType extends BaseServiceType = any> extends BaseServer<ServiceType>{
    readonly ApiCallClass = ApiCallHttp;
    readonly MsgCallClass = MsgCallHttp;

    private _connCounter = new Counter(1);

    readonly options: HttpServerOptions = {
        ...defaultHttpServerOptions
    }

    constructor(proto: ServiceProto<ServiceType>, options?: Partial<HttpServerOptions>) {
        super(proto, options);
    }

    private _status: HttpServerStatus = HttpServerStatus.Closed;
    public get status(): HttpServerStatus {
        return this._status;
    }

    private _httpServer?: http.Server;
    start(): Promise<void> {
        if (this._httpServer) {
            throw new Error('Server already started');
        }

        return new Promise(rs => {
            this._status = HttpServerStatus.Opening;
            this.logger.log(`Starting HTTP server ...`);
            this._httpServer = http.createServer((httpReq, httpRes) => {
                let ip = HttpUtil.getClientIp(httpReq);

                httpRes.statusCode = 200;
                httpRes.setHeader('X-Powered-By', `TSRPC ${TSRPC_VERSION}`);
                if (this.options.cors) {
                    httpRes.setHeader('Access-Control-Allow-Origin', this.options.cors)
                };

                let chunks: Buffer[] = [];
                httpReq.on('data', data => {
                    chunks.push(data);
                });

                let conn: HttpConnection | undefined;
                httpReq.on('end', () => {
                    conn = new HttpConnection({
                        server: this,
                        id: this._connCounter.getNext().toString(36),
                        ip: ip,
                        httpReq: httpReq,
                        httpRes: httpRes
                    });

                    let buf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
                    this._onRecvBuffer(conn, buf);
                });

                // 处理连接异常关闭的情况
                httpRes.on('close', () => {
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
                        (conn.call?.logger || conn.logger).warn('Socket closed without response')
                    }
                });
            });

            if (this.options.socketTimeout) {
                this._httpServer.timeout = this.options.socketTimeout;
            }

            this._httpServer.listen(this.options.port, () => {
                this._status = HttpServerStatus.Opened;
                this.logger.log(`Server started at ${this.options.port}.`);
                rs();
            })
        });
    }

    stop(): Promise<void> {
        return new Promise((rs, rj) => {
            if (!this._httpServer) {
                rs();
                return;
            }
            this._status = HttpServerStatus.Closing;

            // 立即close，不再接受新请求
            // 等所有连接都断开后rs
            this._httpServer.close(err => {
                if (err) {
                    rj(err)
                }
                else {
                    this.logger.log('Server stopped');
                    rs();
                }
            });

            this._httpServer = undefined;
        })
    }

    // HTTP Server 一个conn只有一个call，对应关联之
    protected _makeCall(conn: HttpConnection, input: ParsedServerInput): ApiCallHttp | MsgCallHttp {
        let call = super._makeCall(conn, input) as ApiCallHttp | MsgCallHttp;
        conn.call = call;
        return call;
    }
}

export interface HttpServerOptions extends BaseServerOptions {
    /** 服务端口 */
    port: number,
    /** Socket 超时时间（毫秒） */
    socketTimeout?: number,
    /** 
     * Access-Control-Allow-Origin
     * 默认：当 `NODE_ENV` 不为 `production` 时为 `*`
     */
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
     * JSON 服务根目录
     * 如配置为 `'/api/'`，则请求 URL `/api/a/b/c/Test` 将被映射到 API `a/b/c/Test`
     * 默认为 `'/'`
     */
    jsonRootPath: string,
    /**
     * 是否剔除协议中未定义的多余字段
     * 默认为 `true`
     */
    jsonPrune: boolean
}

export const defaultHttpServerOptions: HttpServerOptions = {
    ...defaultBaseServerOptions,
    port: 3000,
    cors: process.env['NODE_ENV'] === 'production' ? undefined : '*',
    jsonEnabled: true,
    jsonRootPath: '/',
    jsonPrune: true
}


export enum HttpServerStatus {
    Opening = 'OPENING',
    Opened = 'OPENED',
    Closing = 'CLOSING',
    Closed = 'CLOSED',
}