import { BaseServer, BaseServerOptions, defualtBaseServerOptions } from '../BaseServer';
import * as http from "http";
import { HttpConnection } from './HttpConnection';
import { HttpUtil } from '../../models/HttpUtil';
import { HttpCall, ApiCallHttp, MsgCallHttp, ApiCallHttpOptions, MsgCallHttpOptions } from './HttpCall';
import { TransportDataUtil, ParsedServerInput } from '../../models/TransportDataUtil';
import { Counter } from '../../models/Counter';
import { PrefixLogger } from '../Logger';
import { BaseServiceType } from '../../proto/BaseServiceType';
import { Pool } from '../../models/Pool';

export class HttpServer<ServiceType extends BaseServiceType = any> extends BaseServer<HttpServerOptions, ServiceType>{

    protected _poolApiCall: Pool<ApiCallHttp> = new Pool<ApiCallHttp>(ApiCallHttp);
    protected _poolMsgCall: Pool<MsgCallHttp> = new Pool<MsgCallHttp>(MsgCallHttp);

    constructor(options?: Partial<HttpServerOptions>) {
        super(Object.assign({}, defaultHttpServerOptions, options));
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
            this._server = http.createServer((req, res) => {
                let conn: HttpConnection<ServiceType> | undefined;

                res.statusCode = 200;
                if (this._options.cors) {
                    res.setHeader('Access-Control-Allow-Origin', this._options.cors)
                };

                req.on('data', data => {
                    if (!conn) {
                        let ip = HttpUtil.getClientIp(req);
                        conn = HttpConnection.pool.get({
                            server: this,
                            ip: ip,
                            req: req,
                            res: res
                        });
                    }
                    this.onData(conn, data);
                })
            });

            this._server.listen(this._options.port, () => {
                this._status = 'open';
                this.logger.log(`Server started at ${this._options.port}`);
                rs();
            })
        });
    }

    stop(immediately?: boolean): Promise<void> {
        return new Promise(rs => {
            if (!this._server) {
                rs();
                return;
            }
            this._status = 'closing';

            if (immediately) {
                this._server.close(() => {
                    rs();
                })
            }
            else {
                // TODO 等所有请求都结束再关闭
            }

            this._server = undefined;
        })
    }

    protected _parseBuffer(conn: any, buf: Uint8Array): ParsedServerInput {
        let parsed = super._parseBuffer(conn, buf);
        if (parsed.type === 'api') {
            parsed.sn = -1;
        }
        return parsed;
    }
    protected _makeCall(conn: HttpConnection<ServiceType>, input: ParsedServerInput): HttpCall {
        if (input.type === 'api') {
            return ApiCallHttp.pool.get({
                conn: conn,
                sn: input.sn,
                logger: PrefixLogger.pool.get({
                    logger: conn.logger,
                    prefix: `API#${conn.sn} ${input.service.name}`
                }),
                service: input.service,
                req: input.req
            })
        }
        else {
            return MsgCallHttp.pool.get({
                conn: conn,
                logger: PrefixLogger.pool.get({
                    logger: conn.logger,
                    prefix: `MSG#${conn.sn} ${input.service.name}`
                }),
                service: input.service,
                msg: input.msg
            })
        }
    }

    // Override function type
    implementApi!: <T extends keyof ServiceType['req']>(apiName: T, handler: ApiHandlerHttp<ServiceType,ServiceType['req'][T], ServiceType['res'][T]>) => void;
    listenMsg!: <T extends keyof ServiceType['msg']>(msgName: T, handler: MsgHandlerHttp<ServiceType,ServiceType['msg'][T]>) => void;
}

export const defaultHttpServerOptions: HttpServerOptions = {
    ...defualtBaseServerOptions,
    port: 3000
}

export interface HttpServerOptions extends BaseServerOptions {
    port: number,
    cors?: string
}

type HttpServerStatus = 'opening' | 'open' | 'closing' | 'closed';

export type ApiHandlerHttp<ServiceType extends BaseServiceType = BaseServiceType, Req = any, Res = any> = (call: ApiCallHttp<Req, Res, ServiceType>) => void | Promise<void>;
export type MsgHandlerHttp<ServiceType extends BaseServiceType = BaseServiceType, Msg = any> = (msg: MsgCallHttp<Msg, ServiceType>) => void | Promise<void>;