import { BaseServer, BaseServerOptions, defualtBaseServerOptions } from '../BaseServer';
import * as http from "http";
import { HttpConnection } from './HttpConnection';
import { HttpUtil } from '../../models/HttpUtil';
import { ApiCallHttp, MsgCallHttp } from './HttpCall';
import { ParsedServerInput } from '../../models/TransportDataUtil';
import { BaseServiceType } from 'tsrpc-proto';
import { Pool } from '../../models/Pool';
import { Counter } from '../../models/Counter';
import { tsrpcVersion } from '../../../tsrpcVersion';

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

                httpReq.on('close', () => {
                    if (!httpRes.finished) {
                        if (conn) {
                            conn.close('NO_RES');
                        }
                        else {
                            this.logger.log(`Client disconnected. url=${httpReq.url}, ip=${ip}`);
                            httpRes.end();
                        }
                    }
                })
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

    // Override function type
    implementApi!: <T extends keyof ServiceType['req']>(apiName: T, handler: ApiHandlerHttp<ServiceType['req'][T], ServiceType['res'][T], ServiceType>) => void;
    listenMsg!: <T extends keyof ServiceType['msg']>(msgName: T, handler: MsgHandlerHttp<ServiceType['msg'][T], ServiceType>) => void;
}

export const defaultHttpServerOptions: HttpServerOptions<any> = {
    ...defualtBaseServerOptions,
    port: 3000
}

export interface HttpServerOptions<ServiceType extends BaseServiceType> extends BaseServerOptions<ServiceType> {
    port: number,
    socketTimeout?: number,
    cors?: string,
    onBadRequest?: (req: http.IncomingMessage) => void
}

type HttpServerStatus = 'opening' | 'open' | 'closing' | 'closed';

export type ApiHandlerHttp<Req, Res, ServiceType extends BaseServiceType = any> = (call: ApiCallHttp<Req, Res, ServiceType>) => void | Promise<void>;
export type MsgHandlerHttp<Msg, ServiceType extends BaseServiceType = any> = (msg: MsgCallHttp<Msg, ServiceType>) => void | Promise<void>;