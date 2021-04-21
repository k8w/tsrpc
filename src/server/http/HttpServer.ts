import * as http from "http";
import { ApiReturn, BaseServiceType, ServiceProto, TsrpcError, TsrpcErrorType } from 'tsrpc-proto';
import { TSRPC_VERSION } from "../..";
import { Counter } from '../../models/Counter';
import { HttpUtil } from '../../models/HttpUtil';
import { ParsedServerInput } from '../../models/TransportDataUtil';
import { BaseServer, BaseServerOptions, defaultBaseServerOptions, ServerStatus } from '../base/BaseServer';
import { ApiCallHttp } from './ApiCallHttp';
import { HttpConnection } from './HttpConnection';
import { MsgCallHttp } from "./MsgCallHttp";

export class HttpServer<ServiceType extends BaseServiceType> extends BaseServer<ServiceType>{
    readonly ApiCallClass = ApiCallHttp;
    readonly MsgCallClass = MsgCallHttp;

    private _connCounter = new Counter(1);

    readonly options!: HttpServerOptions<ServiceType>;

    constructor(proto: ServiceProto<ServiceType>, options?: Partial<HttpServerOptions<ServiceType>>) {
        super(proto, {
            ...defaultHttpServerOptions,
            ...options
        });

        // 确保 jsonRootPath 以 / 开头和结尾
        this.options.jsonRootPath = this.options.jsonRootPath ?
            (this.options.jsonRootPath.startsWith('/') ? '' : '/') + this.options.jsonRootPath + (this.options.jsonRootPath.endsWith('/') ? '' : '/')
            : '/';
    }

    httpServer?: http.Server;
    start(): Promise<void> {
        if (this.httpServer) {
            throw new Error('Server already started');
        }

        return new Promise(rs => {
            this._status = ServerStatus.Opening;
            this.logger.log(`Starting HTTP server ...`);
            this.httpServer = http.createServer((httpReq, httpRes) => {
                if (this.status !== ServerStatus.Opened) {
                    httpRes.statusCode = 503;
                    httpRes.end();
                    return;
                }

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

                let conn: HttpConnection<ServiceType> | undefined;
                httpReq.on('end', async () => {
                    let isJSON = this.options.jsonEnabled && httpReq.headers["content-type"]?.toLowerCase() === 'application/json'
                        && httpReq.method === 'POST' && httpReq.url?.startsWith(this.options.jsonRootPath);
                    conn = new HttpConnection({
                        server: this,
                        id: '' + this._connCounter.getNext(),
                        ip: ip,
                        httpReq: httpReq,
                        httpRes: httpRes,
                        isJSON: isJSON
                    });
                    await this.flows.postConnectFlow.exec(conn, conn.logger);

                    let buf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);

                    if (isJSON) {
                        this._onRecvJSON(conn, chunks.toString())
                    }
                    else {
                        this._onRecvBuffer(conn, buf);
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

                    conn?.destroy();
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

    protected async _onRecvJSON(conn: HttpConnection<ServiceType>, jsonStr: string) {
        // 1. 根据 URL 判断 service
        let serviceName = conn.httpReq.url!.substr(this.options.jsonRootPath.length);
        let service = this.serviceMap.apiName2Service[serviceName] ?? this.serviceMap.msgName2Service[serviceName];
        if (!service) {
            conn.httpRes.statusCode = 404;
            this._returnJSON(conn, {
                isSucc: false,
                err: {
                    message: 'Service Not Found: ' + serviceName,
                    type: TsrpcErrorType.ServerError,
                    code: 'URL_ERR'
                }
            });
            return;
        }

        // 2. 解析 JSON 字符串
        let req: any;
        try {
            req = JSON.parse(jsonStr);
        }
        catch (e) {
            conn.logger.error(`Parse JSON Error: ${e.message}, jsonStr=` + JSON.stringify(jsonStr));
            conn.httpRes.statusCode = 500;
            this._returnJSON(conn, {
                isSucc: false,
                err: {
                    message: e.message,
                    type: TsrpcErrorType.ServerError,
                    code: 'JSON_ERR'
                }
            });
            return;
        }

        // 3. Prune
        if (this.options.jsonPrune) {
            let opPrune = this.tsbuffer.prune(req, service.type === 'api' ? service.reqSchemaId : service.msgSchemaId);
            if (!opPrune.isSucc) {
                conn.httpRes.statusCode = 400;
                this._returnJSON(conn, {
                    isSucc: false,
                    err: {
                        message: opPrune.errMsg,
                        type: TsrpcErrorType.ServerError,
                        code: 'REQ_VALIDATE_ERR'
                    }
                })
                return;
            }
            req = opPrune.pruneOutput;
        }

        // 4. MakeCall
        let call = this._makeCall(conn, service.type === 'api' ? {
            type: 'api',
            service: service,
            req: req
        } : {
            type: 'msg',
            service: service,
            msg: req
        });

        // 5. onApi / onMsg
        if (call.type === 'api') {
            ++this._pendingApiCallNum;
            await this._onApiCall(call);
            if (--this._pendingApiCallNum === 0) {
                this._gracefulStop?.rs();
            }
        }
        else {
            await this._onMsgCall(call);
        }
    }
    protected _returnJSON(conn: HttpConnection<ServiceType>, ret: ApiReturn<any>) {
        conn.httpRes.end(JSON.stringify(ret.isSucc ? ret : {
            isSucc: false,
            err: ret instanceof TsrpcError ? { ...ret.err } : ret.err
        }))
    }

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

    // HTTP Server 一个conn只有一个call，对应关联之
    protected _makeCall(conn: HttpConnection<ServiceType>, input: ParsedServerInput): ApiCallHttp | MsgCallHttp {
        let call = super._makeCall(conn, input) as ApiCallHttp | MsgCallHttp;
        conn.call = call;
        return call;
    }
}

export interface HttpServerOptions<ServiceType extends BaseServiceType> extends BaseServerOptions<ServiceType> {
    /** 服务端口 */
    port: number,
    /** Socket 超时时间（毫秒） */
    socketTimeout?: number,
    /**
     * HTTP Socket连接 KeepAlive 超时时间（毫秒）
     * 默认同 NodeJS 为 5000
     */
    keepAliveTimeout?: number,
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

export const defaultHttpServerOptions: HttpServerOptions<any> = {
    ...defaultBaseServerOptions,
    port: 3000,
    cors: process.env['NODE_ENV'] === 'production' ? undefined : '*',
    jsonEnabled: true,
    jsonRootPath: '/',
    jsonPrune: true

    // TODO: keep-alive time (to SLB)
}

// TODO JSON