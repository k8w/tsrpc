import * as http from "http";
import { BaseServiceType } from "tsrpc-proto";
import * as WebSocket from "ws";
import { BaseConnection, BaseConnectionOptions, ConnectionStatus } from "../base/BaseConnection";
import { PrefixLogger } from "../models/PrefixLogger";
import { ApiCallWs } from "./ApiCallWs";
import { WsServer } from "./WsServer";

export interface WsConnectionOptions<ServiceType extends BaseServiceType> extends BaseConnectionOptions<ServiceType> {
    server: WsServer<ServiceType>,
    ws: WebSocket,
    httpReq: http.IncomingMessage,
    onClose: (conn: WsConnection<ServiceType>, code: number, reason: string) => Promise<void>
}

/**
 * Connected client
 */
export class WsConnection<ServiceType extends BaseServiceType = any> extends BaseConnection<ServiceType> {
    readonly type = "LONG";

    readonly ws: WebSocket;
    readonly httpReq: http.IncomingMessage;
    readonly server!: WsServer<ServiceType>;

    constructor(options: WsConnectionOptions<ServiceType>) {
        super(options, new PrefixLogger({
            logger: options.server.logger,
            prefixs: [`${options.ip} Conn#${options.id}`]
        }));
        this.ws = options.ws;
        this.httpReq = options.httpReq;

        // Init WS
        this.ws.onclose = async e => {
            await options.onClose(this, e.code, e.reason);
            this._rsClose?.();
        };
        this.ws.onerror = e => { this.logger.warn('[ClientErr]', e.error) };
        this.ws.onmessage = e => {
            let data = e.data;
            if (typeof data === 'string') {
                this.logger.log('[RecvStr]', this.server.options.logReqBody ? data : (data.length > 100 ? `${data.substr(0, 100)}... (length=${data.length})` : data))
                return;
            }
            if (data instanceof ArrayBuffer) {
                data = Buffer.from(data);
            }
            if (Array.isArray(data)) {
                data = Buffer.concat(data)
            }
            if (Buffer.isBuffer(data)) {
                this.server._onRecvBuffer(this, data)
            }
        };
    }

    get status(): ConnectionStatus {
        if (this.ws.readyState === WebSocket.CLOSED) {
            return ConnectionStatus.Closed;
        }
        if (this.ws.readyState === WebSocket.CLOSING) {
            return ConnectionStatus.Closing;
        }
        return ConnectionStatus.Opened;
    }

    /**
     * {@inheritDoc BaseConnection.sendBuf}
     * @internal
     */
    async sendBuf(buf: Uint8Array, call?: ApiCallWs): Promise<{ isSucc: true; } | { isSucc: false; errMsg: string; }> {
        // Pre Flow
        let pre = await this.server.flows.preSendBufferFlow.exec({ conn: this, buf: buf, call: call }, call?.logger || this.logger);
        if (!pre) {
            return { isSucc: false, errMsg: 'preSendBufferFlow Error' };
        }
        buf = pre.buf;

        this.server.options.debugBuf && this.logger.debug('[SendBuf]', buf);
        let opSend = await new Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>((rs) => {
            this.ws.send(buf, e => {
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