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

    readonly options: WsServerOptions<ServiceType> = {
        ...defaultWsServerOptions
    }

    private readonly _conns: WsConnection<ServiceType>[] = [];
    private readonly _id2Conn: { [connId: string]: WsConnection<ServiceType> | undefined } = {};
    private _connIdCounter = new Counter(1);

    constructor(proto: ServiceProto<ServiceType>, options?: Partial<WsServerOptions<ServiceType>>) {
        super(proto, options);
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
        rs: () => void,
        rj: (e: any) => void;
    }
    async stop(immediately: boolean = false): Promise<void> {
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
                    rs: rs,
                    rj: rj
                }
                if (this._conns.length) {
                    for (let conn of this._conns) {
                        conn.close();
                    }
                }
                else {
                    this._wsServer && this._wsServer.close(e => {
                        this._stopping = undefined;
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
        })

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
        });
        this._conns.push(conn);
        this._id2Conn[conn.id] = conn;

        conn.logger.log('[Connected]', `ActiveConn=${this._conns.length}`);
        this.flows.postConnectFlow.exec(conn, conn.logger);
    };



    private _onClientClose = (conn: WsConnection<ServiceType>, code: number, reason: string) => {
        conn.logger.log('[Disconnected]', `Code=${code} ${reason ? `Reason=${reason} ` : ''}ActiveConn=${this._conns.length}`)
        this._conns.removeOne(v => v.id === conn.id);
        this._id2Conn[conn.id] = undefined;

        // 优雅地停止
        if (this._stopping && this._conns.length === 0) {
            this._wsServer && this._wsServer.close(e => {
                this._status = ServerStatus.Closed;
                if (this._stopping) {
                    e ? this._stopping.rj(e) : this._stopping!.rs();
                    this._stopping = undefined;
                }
            });
        }
    }

    // Send Msg
    async sendMsg<T extends keyof ServiceType['msg']>(connIds: string[], msgName: T, msg: ServiceType['msg'][T]): Promise<void> {
        if (this.status !== ServerStatus.Opened) {
            this.logger.error('Server not open, sendMsg failed');
            return;
        }

        // GetService
        let service = this.serviceMap.msgName2Service[msgName as string];
        if (!service) {
            throw new Error('Invalid msg name: ' + msgName)
        }

        // Encode
        let transportData = TransportDataUtil.encodeMsg(this.tsbuffer, service, msg);

        // Batch send
        await Promise.all(connIds.map(v => {
            let conn = this._id2Conn[v];
            if (conn) {
                conn.ws.send(transportData)
            }
            else {
                this.logger.error('SendMsg failed, invalid connId: ' + v)
            }
        }))
    };
}

export interface WsServerOptions<ServiceType extends BaseServiceType> extends BaseServerOptions<ServiceType> {
    port: number;
};

const defaultWsServerOptions: WsServerOptions<any> = {
    ...defaultBaseServerOptions,
    port: 3000
}