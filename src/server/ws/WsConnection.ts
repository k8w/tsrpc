import * as http from "http";
import * as WebSocket from "ws";
import { PrefixLogger } from '../Logger';
import { BaseServiceType } from "tsrpc-proto";
import { WsServer } from "./WsServer";
import { PoolItem, Pool } from '../../models/Pool';
import { HttpUtil } from "../../models/HttpUtil";
import { TransportDataUtil } from '../../models/TransportDataUtil';
import { ConnectionCloseReason, BaseConnection } from '../BaseServer';

export interface WsConnectionOptions<ServiceType extends BaseServiceType, SessionType> {
    connId: number,
    server: WsServer<ServiceType, SessionType>,
    ws: WebSocket,
    httpReq: http.IncomingMessage,
    defaultSession: SessionType,
    onClose: (conn: WsConnection<ServiceType, SessionType>, code: number, reason: string) => void,
    onRecvData: (data: Buffer) => void;
}

/**
 * 当前活跃的连接
 */
export class WsConnection<ServiceType extends BaseServiceType, SessionType> extends PoolItem<WsConnectionOptions<ServiceType, SessionType>> implements BaseConnection {

    static pool = new Pool<WsConnection<any, any>>(WsConnection);

    ip!: string;
    session!: SessionType;
    logger!: PrefixLogger;

    get connId() {
        return this.options.connId;
    }

    get server() {
        return this.options.server;
    }

    get ws() {
        return this.options.ws;
    }

    reset(options: this['options']) {
        super.reset(options);

        this.ip = HttpUtil.getClientIp(this.options.httpReq);
        this.session = Object.merge({}, options.defaultSession);
        this.logger = PrefixLogger.pool.get({
            logger: this.options.server.logger,
            prefixs: [`[Conn#${options.connId}] [${this.ip}]`]
        });

        // Init WS
        options.ws.onclose = e => { this.options.onClose(this, e.code, e.reason); };
        options.ws.onerror = e => { this.logger.warn('[CLIENT_ERR]', e.error); };
        options.ws.onmessage = e => {
            if (Buffer.isBuffer(e.data)) {
                this.options.onRecvData(e.data)
            }
            else {
                this.logger.log('[RECV]', e.data)
            }
        };
    }

    clean() {
        if (this.options.ws && this.options.ws.readyState === WebSocket.OPEN) {
            this.options.ws.close()
        }
        this.options.ws.onopen = this.options.ws.onclose = this.options.ws.onmessage = this.options.ws.onerror = undefined as any;

        super.clean();
        this.logger.destroy();
        this.ip = this.session = this.logger = undefined as any;
    }

    destroy() {
        WsConnection.pool.put(this);
    }

    // Send Msg
    sendMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T]) {
        let service = this.options.server.serviceMap.msgName2Service[msgName as string];
        if (!service) {
            throw new Error('Invalid msg name: ' + msgName);
        }

        let buf = TransportDataUtil.encodeMsg(this.options.server.tsbuffer, service, msg);
        return new Promise((rs, rj) => {
            this.options.ws.send(buf, e => {
                e ? rj(e) : rs();
            })
        })
    };

    close(reason?: ConnectionCloseReason) {
        // 已连接 Close之
        this.options.ws.close(1000, reason || 'Server Closed');
    }

    get isClosed(): boolean {
        return this.options.ws.readyState !== WebSocket.OPEN;
    }
}