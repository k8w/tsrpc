import * as http from "http";
import { EncodeOutput, TransportDataUtil } from "tsrpc-base-client";
import { BaseServiceType, ServiceProto } from 'tsrpc-proto';
import * as WebSocket from 'ws';
import { Server as WebSocketServer } from 'ws';
import { HttpUtil } from '../../models/HttpUtil';
import { BaseServer, BaseServerOptions, defaultBaseServerOptions, ServerStatus } from '../base/BaseServer';
import { WsConnection } from './WsConnection';

/**
 * TSRPC Server, based on WebSocket connection.
 * It can support realtime cases.
 * @typeParam ServiceType - `ServiceType` from generated `proto.ts`
 */
export class WsServer<ServiceType extends BaseServiceType = any> extends BaseServer<ServiceType> {
    readonly options!: WsServerOptions<ServiceType>;

    readonly connections: WsConnection<ServiceType>[] = [];
    private readonly _id2Conn: { [connId: string]: WsConnection<ServiceType> | undefined } = {};

    constructor(proto: ServiceProto<ServiceType>, options?: Partial<WsServerOptions<ServiceType>>) {
        super(proto, {
            ...defaultWsServerOptions,
            ...options
        });
    }

    private _wsServer?: WebSocketServer;

    /**
     * {@inheritDoc BaseServer.start}
     */
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
                this.logger.error('[ServerError]', e);
                rj(e);
            });
        })
    }

    /**
     * {@inheritDoc BaseServer.stop}
     */
    async stop(): Promise<void> {
        // Closed Already
        if (!this._wsServer) {
            throw new Error('Server has not been started')
        }
        if (this._status === ServerStatus.Closed) {
            throw new Error('Server is closed already');
        }

        this._status = ServerStatus.Closing;

        return new Promise<void>(async (rs, rj) => {
            await Promise.all(this.connections.map(v => v.close('Server Stop')));
            this._wsServer!.close(err => { err ? rj(err) : rs() })
        }).then(() => {
            this.logger.log('Server stopped');
            this._status = ServerStatus.Closed;
            this._wsServer = undefined;
        });
    }

    private _onClientConnect = (ws: WebSocket, httpReq: http.IncomingMessage) => {
        // 停止中 不再接受新的连接
        if (this._status !== ServerStatus.Opened) {
            ws.close(1012);
            return;
        }

        // 推测 dataType 和 isDataTypeConfirmed
        let isDataTypeConfirmed = true;
        let dataType: 'text' | 'buffer';
        let protocols = httpReq.headers['sec-websocket-protocol']?.split(',').map(v => v.trim()).filter(v => !!v);
        if (protocols?.includes('text')) {
            dataType = 'text';
        }
        else if (protocols?.includes('buffer')) {
            dataType = 'buffer';
        }
        else {
            dataType = this.options.jsonEnabled ? 'text' : 'buffer';
            isDataTypeConfirmed = false;
        }

        // Create Active Connection
        let conn = new WsConnection({
            id: '' + this._connIdCounter.getNext(),
            ip: HttpUtil.getClientIp(httpReq),
            server: this,
            ws: ws,
            httpReq: httpReq,
            onClose: this._onClientClose,
            dataType: dataType,
            isDataTypeConfirmed: isDataTypeConfirmed
        });
        this.connections.push(conn);
        this._id2Conn[conn.id] = conn;

        conn.logger.log('[Connected]', `ActiveConn=${this.connections.length}`);
        this.flows.postConnectFlow.exec(conn, conn.logger);
    };

    private _onClientClose = async (conn: WsConnection<ServiceType>, code: number, reason: string) => {
        this.connections.removeOne(v => v.id === conn.id);
        delete this._id2Conn[conn.id];
        conn.logger.log('[Disconnected]', `Code=${code} ${reason ? `Reason=${reason} ` : ''}ActiveConn=${this.connections.length}`)

        await this.flows.postDisconnectFlow.exec({ conn: conn, reason: reason }, conn.logger);
    }

    /**
     * Send the same message to many connections.
     * No matter how many target connections are, the message would be only encoded once.
     * @param msgName 
     * @param msg - Message body
     * @param connIds - `id` of target connections, `undefined` means broadcast to every connections.
     * @returns Send result, `isSucc: true` means the message buffer is sent to kernel, not represents the clients received.
     */
    async broadcastMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T], conns?: WsConnection<ServiceType>[]): Promise<{ isSucc: true; } | { isSucc: false; errMsg: string; }> {
        let connStr: string;
        if (!conns) {
            conns = this.connections;
            connStr = '*';
        }
        else {
            connStr = conns ? conns.map(v => v.id).join(',') : '*';
        }

        if (!conns.length) {
            return { isSucc: true };
        }

        if (this.status !== ServerStatus.Opened) {
            this.logger.warn('[BroadcastMsgErr]', `[${msgName}]`, `[To:${connStr}]`, 'Server not open');
            return { isSucc: false, errMsg: 'Server not open' };
        }

        // GetService
        let service = this.serviceMap.msgName2Service[msgName as string];
        if (!service) {
            this.logger.warn('[BroadcastMsgErr]', `[${msgName}]`, `[To:${connStr}]`, 'Invalid msg name: ' + msgName);
            return { isSucc: false, errMsg: 'Invalid msg name: ' + msgName };
        }

        // Encode group by dataType
        let _opEncodeBuf: EncodeOutput<Uint8Array> | undefined;
        let _opEncodeText: EncodeOutput<string> | undefined;
        const getOpEncodeBuf = () => {
            if (!_opEncodeBuf) {
                _opEncodeBuf = TransportDataUtil.encodeServerMsg(this.tsbuffer, service!, msg, 'buffer', 'LONG');
            }
            return _opEncodeBuf;
        }
        const getOpEncodeText = () => {
            if (!_opEncodeText) {
                _opEncodeText = TransportDataUtil.encodeServerMsg(this.tsbuffer, service!, msg, 'text', 'LONG');
            }
            return _opEncodeText;
        }

        // 测试一下编码可以通过
        let op = conns.some(v => v.dataType === 'buffer') ? getOpEncodeBuf() : getOpEncodeText();
        if (!op.isSucc) {
            this.logger.warn('[BroadcastMsgErr]', `[${msgName}]`, `[To:${connStr}]`, op.errMsg);
            return op;
        }

        this.options.logMsg && this.logger.log(`[BroadcastMsg]`, `[${msgName}]`, `[To:${connStr}]`, msg);

        // Batch send
        let errMsgs: string[] = [];
        return Promise.all(conns.map(async conn => {
            // Pre Flow
            let pre = await this.flows.preSendMsgFlow.exec({ conn: conn, service: service!, msg: msg }, this.logger);
            if (!pre) {
                conn.logger.debug('[preSendMsgFlow]', 'Canceled');
                return { isSucc: false, errMsg: 'Prevented by preSendMsgFlow' };
            }
            msg = pre.msg;

            // Do send!
            let opSend = await conn.sendData((conn.dataType === 'buffer' ? getOpEncodeBuf() : getOpEncodeText())!.output!);
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
    /** Which port the WebSocket server is listen to */
    port: number;

    /** 
     * Close a connection if not receive heartbeat after the time (ms).
     * This value should be greater than `client.heartbeat.interval`, for exmaple 2x of it.
     * `undefined` or `0` represent disable this feature.
     * @defaultValue `undefined`
     */
    heartbeatWaitTime?: number;
};

const defaultWsServerOptions: WsServerOptions<any> = {
    ...defaultBaseServerOptions,
    port: 3000
}