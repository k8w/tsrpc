import * as WebSocket from 'ws';
import { Server as WebSocketServer } from 'ws';
import * as http from "http";
import { WsConnection } from './WsConnection';
import { Counter } from '../../models/Counter';
import { BaseServer, BaseServerOptions } from '../BaseServer';
import { ApiCallWs, MsgCallWs } from './WsCall';
import { TransportDataUtil } from '../../models/TransportDataUtil';
import { Pool } from '../../models/Pool';
import { BaseServiceType } from 'tsrpc-proto';

export class WsServer<ServiceType extends BaseServiceType = any, SessionType = { [key: string]: any | undefined }> extends BaseServer<WsServerOptions<ServiceType, SessionType>, ServiceType> {

    protected _poolApiCall: Pool<ApiCallWs> = new Pool<ApiCallWs>(ApiCallWs);
    protected _poolMsgCall: Pool<MsgCallWs> = new Pool<MsgCallWs>(MsgCallWs);

    private readonly _conns: WsConnection<ServiceType, SessionType>[] = [];
    private readonly _id2Conn: { [connId: string]: WsConnection<ServiceType, SessionType> | undefined } = {};

    private _connIdCounter = new Counter(1);

    constructor(options?: Partial<WsServerOptions<ServiceType, SessionType>>) {
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
                port: this.options.port
            }, () => {
                this.logger.log(`Server started at ${this.options.port}...`);
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
            defaultSession: this.options.defaultSession,
            onClose: this._onClientClose,
            onRecvData: v => { this.onData(conn, v) }
        });
        this._conns.push(conn);
        this._id2Conn[conn.connId] = conn;

        conn.logger.log('[Connected]', `ActiveConn=${this._conns.length}`)
    };



    private _onClientClose = (conn: WsConnection<ServiceType, SessionType>, code: number, reason: string) => {
        conn.logger.log('[Disconnected]', `Code=${code} ${reason ? `Reason=${reason} ` : ''}ActiveConn=${this._conns.length}`)
        this._conns.removeOne(v => v.connId === conn.connId);
        this._id2Conn[conn.connId] = undefined;

        // 优雅地停止
        if (this._stopping && this._conns.length === 0) {
            this._wsServer && this._wsServer.close(e => {
                this._status = 'closed';
                if (this._stopping) {
                    e ? this._stopping.rj(e) : this._stopping!.rs();
                    this._stopping = undefined;
                }                
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
                conn.options.ws.send(transportData)
            }
            else {
                this.logger.error('SendMsg failed, invalid connId: ' + v)
            }
        }))
    };

    // Override function type
    implementApi!: <T extends keyof ServiceType['req']>(apiName: T, handler: ApiHandlerWs<ServiceType['req'][T], ServiceType['res'][T], ServiceType, SessionType>) => void;
    listenMsg!: <T extends keyof ServiceType['msg']>(msgName: T, handler: MsgHandlerWs<ServiceType['msg'][T], ServiceType, SessionType>) => void;

}

export type WsServerStatus = 'opening' | 'open' | 'closing' | 'closed';

const defaultWsServerOptions: WsServerOptions<any, any> = {
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

export interface WsServerOptions<ServiceType extends BaseServiceType, SessionType> extends BaseServerOptions<ServiceType> {
    port: number;
    defaultSession: SessionType;
};

export type ApiHandlerWs<Req, Res, ServiceType extends BaseServiceType = any, SessionType = any> = (call: ApiCallWs<Req, Res, ServiceType, SessionType>) => void | Promise<void>;
export type MsgHandlerWs<Msg, ServiceType extends BaseServiceType = any, SessionType = any> = (msg: MsgCallWs<Msg, ServiceType, SessionType>) => void | Promise<void>;