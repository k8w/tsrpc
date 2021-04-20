import * as http from "http";
import { BaseServiceType, ServiceProto } from 'tsrpc-proto';
import * as WebSocket from 'ws';
import { Server as WebSocketServer } from 'ws';
import { MsgCallWs } from '../..';
import { Counter } from '../../models/Counter';
import { HttpUtil } from '../../models/HttpUtil';
import { TransportDataUtil } from '../../models/TransportDataUtil';
import { BaseServer, BaseServerOptions, defaultBaseServerOptions, ServerStatus } from '../base/BaseServer';
import { ApiCallWs } from './ApiCallWs';
import { WsConnection } from './WsConnection';

export class WsServer<ServiceType extends BaseServiceType = any> extends BaseServer<ServiceType> {
    readonly ApiCallClass = ApiCallWs;
    readonly MsgCallClass = MsgCallWs;

    readonly options!: WsServerOptions<ServiceType>;

    readonly connections: WsConnection<ServiceType>[] = [];
    private readonly _id2Conn: { [connId: string]: WsConnection<ServiceType> | undefined } = {};
    private _connIdCounter = new Counter(1);

    constructor(proto: ServiceProto<ServiceType>, options?: Partial<WsServerOptions<ServiceType>>) {
        super(proto, {
            ...defaultWsServerOptions,
            ...options
        });
    }

    private _status: ServerStatus = ServerStatus.Closed;
    public get status(): ServerStatus {
        return this._status;
    }

    private _wsServer?: WebSocketServer;
    start(): Promise<void> {
        if (this._wsServer) {
            throw new Error('Server already started');
        }

        this._stopping = undefined;
        this._status = ServerStatus.Opening;
        return new Promise((rs, rj) => {
            this.logger.log('Starting WebSocket server...');
            this._wsServer = new WebSocketServer({
                port: this.options.port
            }, () => {
                this.logger.log(`Server started at ${this.options.port}...`);
                this._status = ServerStatus.Opened;
                rs();
            });

            this._wsServer.on('connection', this._onClientConnect);
            this._wsServer.on('error', e => {
                this.logger.error('[Server Error]', e);
                rj(e);
            });
        })
    }

    private _stopping?: {
        promise: Promise<void>,
        rs: () => void,
        rj: (e: any) => void,
    }
    async stop(immediately: boolean = false): Promise<void> {
        if (this._stopping) {
            return this._stopping.promise;
        }

        if (!this._wsServer || this._status === ServerStatus.Closed) {
            return;
        }

        this._status = ServerStatus.Closing;
        let output = new Promise<void>(async (rs, rj) => {
            if (!this._wsServer) {
                throw new Error('Server has not been started')
            }

            if (immediately) {
                this._wsServer.close(() => { rs(); })
            }
            else {
                // 优雅地停止
                this._stopping = {
                    promise: output,
                    rs: rs,
                    rj: rj,
                }
                if (this.connections.length) {
                    for (let conn of this.connections) {
                        conn.close();
                    }
                }
                else {
                    this._wsServer && this._wsServer.close(e => {
                        this._status = ServerStatus.Closed;
                        e ? rj(e) : rs();
                    });
                }
            }
        });

        output.then(() => {
            this.logger.log('[SRV_STOP] Server stopped');
            this._status = ServerStatus.Closed;
            this._wsServer = undefined;
        });

        return output;
    }

    private _onClientConnect = (ws: WebSocket, httpReq: http.IncomingMessage) => {
        // 停止中 不再接受新的连接
        if (this._stopping) {
            ws.close();
            return;
        }

        // Create Active Connection
        let conn = new WsConnection({
            id: '' + this._connIdCounter.getNext(),
            ip: HttpUtil.getClientIp(httpReq),
            server: this,
            ws: ws,
            httpReq: httpReq,
            onClose: this._onClientClose
        });
        this.connections.push(conn);
        this._id2Conn[conn.id] = conn;

        conn.logger.log('[Connected]', `ActiveConn=${this.connections.length}`);
        this.flows.postConnectFlow.exec(conn, conn.logger);
    };



    private _onClientClose = (conn: WsConnection<ServiceType>, code: number, reason: string) => {
        conn.logger.log('[Disconnected]', `Code=${code} ${reason ? `Reason=${reason} ` : ''}ActiveConn=${this.connections.length}`)
        this.connections.removeOne(v => v.id === conn.id);
        this._id2Conn[conn.id] = undefined;

        // 优雅地停止
        if (this._stopping && this.connections.length === 0) {
            this._wsServer && this._wsServer.close(e => {
                this._status = ServerStatus.Closed;
                if (this._stopping) {
                    e ? this._stopping.rj(e) : this._stopping!.rs();
                }
            });
        }
    }

    // Send Msg
    async broadcastMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T], connIds?: string[]): Promise<{ isSucc: true; } | { isSucc: false; errMsg: string; }> {
        if (this.status !== ServerStatus.Opened) {
            return { isSucc: false, errMsg: 'Server not open' };
        }

        // GetService
        let service = this.serviceMap.msgName2Service[msgName as string];
        if (!service) {
            return { isSucc: false, errMsg: 'Invalid msg name: ' + msgName };
        }

        // Encode
        let opEncode = TransportDataUtil.encodeServerMsg(this.tsbuffer, service, msg);
        if (!opEncode.isSucc) {
            return opEncode;
        }

        let errMsgs: string[] = [];
        let conns = (connIds ? connIds.map(v => {
            let conn = this._id2Conn[v];
            if (!conn) {
                errMsgs.push(`Error connId '${v}'`);
            }
            return conn;
        }).filter(v => !!v) : this.connections) as WsConnection<ServiceType>[];

        // Batch send
        return Promise.all(conns.map(async conn => {
            // Pre Flow
            let pre = await this.flows.preSendMsgFlow.exec({ conn: conn, service: service!, msg: msg }, this.logger);
            if (!pre) {
                return { isSucc: false, errMsg: 'sendMsg prevent by preSendMsgFlow' };
            }
            msg = pre.msg;

            // Do send!
            let opSend = await conn.sendBuf(opEncode.buf!);
            if (!opSend.isSucc) {
                return opSend;
            }

            // Post Flow
            this.flows.postSendMsgFlow.exec(pre, this.logger);

            return { isSucc: true };
        })).then(results => {
            for (let i = 0; i < results.length; ++i) {
                let op = results[i];
                if (!op.isSucc) {
                    errMsgs.push(`Conn#conns[i].id: ${op.errMsg}`)
                };
            }
            if (errMsgs.length) {
                return { isSucc: false, errMsg: errMsgs.join('\n') }
            }
            else {
                return { isSucc: true }
            }
        })
    };
}

export interface WsServerOptions<ServiceType extends BaseServiceType> extends BaseServerOptions<ServiceType> {
    port: number;
};

const defaultWsServerOptions: WsServerOptions<any> = {
    ...defaultBaseServerOptions,
    port: 3000
}