import * as WebSocket from 'ws';
import { Server as WebSocketServer } from 'ws';
import * as http from "http";
import { WsConnection } from './WSConnection';
import { Counter } from '../../models/Counter';
import { BaseServiceType } from '../../proto/BaseServiceType';
import { BaseServer, BaseServerOptions } from '../BaseServer';
import { ApiCallWs, MsgCallWs } from './WsCall';
import { TransportDataUtil } from '../../models/TransportDataUtil';
import { Pool } from '../../models/Pool';

export class WsServer<ServiceType extends BaseServiceType = any, SessionType = any> extends BaseServer<WsServerOptions<SessionType>, ServiceType> {

    protected _poolApiCall: Pool<ApiCallWs> = new Pool<ApiCallWs>(ApiCallWs);
    protected _poolMsgCall: Pool<MsgCallWs> = new Pool<MsgCallWs>(MsgCallWs);

    private readonly _conns: WsConnection<ServiceType, SessionType>[] = [];
    private readonly _id2Conn: { [connId: string]: WsConnection<ServiceType, SessionType> | undefined } = {};

    private _connIdCounter = new Counter();

    constructor(options?: Partial<WsServerOptions<SessionType>>) {
        super(Object.assign({}, defaultWsServerOptions, options));
    }

    private _status: WsServerStatus = 'closed';
    public get status(): WsServerStatus {
        return this._status;
    }

    private _wsServer?: WebSocketServer;
    start(): Promise<void> {
        if (this._wsServer) {
            throw new Error('Server already started');
        }

        this._status = 'opening';
        return new Promise(rs => {
            this.logger.log('Starting WebSocket server...');
            this._wsServer = new WebSocketServer({
                port: this._options.port
            }, () => {
                this.logger.log(`Server started at ${this._options.port}...`);
                this._status = 'open';
                rs();
            });

            this._wsServer.on('connection', this._onClientConnect);
            this._wsServer.on('error', e => {
                this.logger.error('[Server Error]', e);
            });
        })
    }

    private _stopping?: {
        rs: () => void,
        rj: (e: any) => void;
    }
    async stop(immediately: boolean = false): Promise<void> {
        if (!this._wsServer || this._status === 'closed') {
            return;
        }

        this._status = 'closing';
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
                        this._status = 'closed';
                        e ? rj(e) : rs();
                    });
                }
            }
        });

        output.then(() => {
            this.logger.log('[SRV_STOP] Server stopped');
            this._status = 'closed';
            this._wsServer = undefined;
        })

        return output;
    }

    // ConnID 1 ~ Number.MAX_SAFE_INTEGER
    getNextConnId(): number {
        // 最多尝试1万次
        for (let i = 0; i < 10000; ++i) {
            let connId = this._connIdCounter.getNext();
            if (!this._id2Conn[connId]) {
                return connId;
            }
        }

        this.logger.error('No available connId till ' + this._connIdCounter.last);
        return NaN;
    }

    private _onClientConnect = (ws: WebSocket, httpReq: http.IncomingMessage) => {
        // 停止中 不再接受新的连接
        if (this._stopping) {
            ws.close();
            return;
        }

        let connId = this.getNextConnId()
        if (isNaN(connId)) {
            ws.close();
            return;
        }

        // Create Active Connection
        let conn = WsConnection.pool.get({
            connId: connId,
            server: this,
            ws: ws,
            httpReq: httpReq,
            defaultSession: this._options.defaultSession,
            onClose: this._onClientClose,
            onRecvData: v => { this.onData(conn, v) }
        });
        this._conns.push(conn);
        this._id2Conn[conn.connId] = conn;

        this.logger.log('[CLIENT_CONNECT]', `IP=${conn.ip}`, `ConnID=${conn.connId}`, `ActiveConn=${this._conns.length}`);
    };



    private _onClientClose = (conn: WsConnection<ServiceType, SessionType>, code: number, reason: string) => {
        this._conns.removeOne(v => v.connId === conn.connId);
        this._id2Conn[conn.connId] = undefined;
        this.logger.log('[CLIENT_CLOSE]', `IP=${conn.ip} ConnID=${conn.connId} Code=${code} ${reason ? `Reason=${reason} ` : ''}ActiveConn=${this._conns.length}`);

        // 优雅地停止
        if (this._stopping && this._conns.length === 0) {
            this._wsServer && this._wsServer.close(e => {
                this._stopping = undefined;
                this._status = 'closed';
                e ? this._stopping!.rj(e) : this._stopping!.rs();
            });
        }
    }

    // Send Msg
    async sendMsg<T extends keyof ServiceType['msg']>(connIds: string[], msgName: T, msg: ServiceType['msg'][T]): Promise<void> {
        if (this.status !== 'open') {
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
                conn.sendRaw(transportData)
            }
            else {
                this.logger.error('SendMsg failed, invalid connId: ' + v)
            }
        }))
    };
}

export type WsServerStatus = 'opening' | 'open' | 'closing' | 'closed';

const defaultWsServerOptions: WsServerOptions<any> = {
    port: 3000,
    logger: console,
    proto: {
        services: [],
        types: {}
    },
    defaultSession: {}
}

// event => event data
export interface ServerEventData {
    sendMsg: any,
    resSucc: any,
    resError: any
}

export interface WsServerOptions<SessionType> extends BaseServerOptions {
    port: number;
    defaultSession: SessionType;
};