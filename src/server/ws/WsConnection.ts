import * as http from "http";
import { TransportDataUtil } from "tsrpc-base-client";
import { BaseServiceType } from "tsrpc-proto";
import * as WebSocket from "ws";
import { BaseConnection, BaseConnectionOptions, ConnectionStatus } from "../base/BaseConnection";
import { PrefixLogger } from "../models/PrefixLogger";
import { ApiCallWs } from "./ApiCallWs";
import { MsgCallWs } from "./MsgCallWs";
import { WsServer } from "./WsServer";

export interface WsConnectionOptions<ServiceType extends BaseServiceType> extends BaseConnectionOptions<ServiceType> {
    server: WsServer<ServiceType>,
    ws: WebSocket,
    httpReq: http.IncomingMessage,
    onClose: (conn: WsConnection<ServiceType>, code: number, reason: string) => Promise<void>,
    dataType: 'text' | 'buffer',
    isDataTypeConfirmed?: boolean
}

/**
 * Connected client
 */
export class WsConnection<ServiceType extends BaseServiceType = any> extends BaseConnection<ServiceType> {
    readonly type = "LONG";

    protected readonly ApiCallClass = ApiCallWs;
    protected readonly MsgCallClass = MsgCallWs;

    readonly ws: WebSocket;
    readonly httpReq: http.IncomingMessage;
    readonly server!: WsServer<ServiceType>;
    dataType!: 'text' | 'buffer';
    // 是否已经收到了客户端的第一条消息，以确认了客户端的 dataType
    isDataTypeConfirmed?: boolean;

    constructor(options: WsConnectionOptions<ServiceType>) {
        super(options, new PrefixLogger({
            logger: options.server.logger,
            prefixs: [`${options.ip} Conn#${options.id}`]
        }));
        this.ws = options.ws;
        this.httpReq = options.httpReq;
        this.isDataTypeConfirmed = options.isDataTypeConfirmed;

        if (this.server.options.heartbeatWaitTime) {
            const timeout = this.server.options.heartbeatWaitTime;
            this._heartbeatInterval = setInterval(() => {
                if (Date.now() - this._lastHeartbeatTime > timeout) {
                    this.ws.close(3001, 'Receive heartbeat timeout');
                }
            }, timeout);
        }

        // Init WS
        this.ws.onclose = async e => {
            if (this._heartbeatInterval) {
                clearInterval(this._heartbeatInterval);
                this._heartbeatInterval = undefined;
            }
            await options.onClose(this, e.code, e.reason);
            this._rsClose?.();
        };
        this.ws.onerror = e => { this.logger.warn('[ClientErr]', e.error) };
        this.ws.onmessage = e => {
            let data: Buffer | string;
            if (e.data instanceof ArrayBuffer) {
                data = Buffer.from(e.data);
            }
            else if (Array.isArray(e.data)) {
                data = Buffer.concat(e.data)
            }
            else if (Buffer.isBuffer(e.data)) {
                data = e.data;
            }
            else {
                data = e.data;
            }

            // 心跳包，直接回复
            if (data instanceof Buffer && data.equals(TransportDataUtil.HeartbeatPacket)) {
                this.server.options.debugBuf && this.logger.log('[Heartbeat] Recv ping and send pong', TransportDataUtil.HeartbeatPacket);
                this._lastHeartbeatTime = Date.now();
                this.ws.send(TransportDataUtil.HeartbeatPacket);
                return;
            }

            // dataType 尚未确认，自动检测
            if (!this.isDataTypeConfirmed) {
                if (this.server.options.jsonEnabled && typeof data === 'string') {
                    this.dataType = 'text';
                }
                else {
                    this.dataType = 'buffer';
                }

                this.isDataTypeConfirmed = true;
            }

            // dataType 已确认
            this.server._onRecvData(this, data)
        };
    }

    private _lastHeartbeatTime = 0;
    private _heartbeatInterval?: ReturnType<typeof setInterval>;

    get status(): ConnectionStatus {
        if (this.ws.readyState === WebSocket.CLOSED) {
            return ConnectionStatus.Closed;
        }
        if (this.ws.readyState === WebSocket.CLOSING) {
            return ConnectionStatus.Closing;
        }
        return ConnectionStatus.Opened;
    }

    protected async doSendData(data: string | Uint8Array, call?: ApiCallWs): Promise<{ isSucc: true; } | { isSucc: false; errMsg: string; }> {
        let opSend = await new Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>((rs) => {
            this.ws.send(data, e => {
                e ? rs({ isSucc: false, errMsg: e.message || 'Send buffer error' }) : rs({ isSucc: true });
            })
        });
        if (!opSend.isSucc) {
            return opSend;
        }

        return { isSucc: true }
    }

    protected _rsClose?: () => void;
    /** Close WebSocket connection */
    close(reason?: string): Promise<void> {
        // 已连接 Close之
        return new Promise<void>(rs => {
            this._rsClose = rs;
            this.ws.close(1000, reason);
        }).finally(() => {
            this._rsClose = undefined
        })
    }
}