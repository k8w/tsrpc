import * as http from "http";
import * as WebSocket from "ws";
import { BaseConnection, BaseConnectionOptions, ConnectionStatus } from "../base/BaseConnection";
import { ApiCallWs } from "./ApiCallWs";
import { WsServer } from "./WsServer";

export interface WsConnectionOptions extends BaseConnectionOptions {
    server: WsServer,
    ws: WebSocket,
    httpReq: http.IncomingMessage
}

/**
 * 当前活跃的连接
 */
export class WsConnection extends BaseConnection {
    readonly type = "LONG";

    readonly ws: WebSocket;
    readonly httpReq: http.IncomingMessage;

    constructor(options: WsConnectionOptions) {
        super(options);
        this.ws = options.ws;
        this.httpReq = options.httpReq;

        // Init WS
        this.ws.onclose = e => {
            this.logger.log('Closed');
            this.server.flows.postDisconnectFlow.exec({ conn: this, reason: e.reason })
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
        return {
            [WebSocket.CLOSED]: ConnectionStatus.Closed,
            [WebSocket.CLOSING]: ConnectionStatus.Closing
        }[this.ws.readyState] || ConnectionStatus.Opened;
    }

    async sendBuf(buf: Uint8Array, call?: ApiCallWs): Promise<{ isSucc: true; } | { isSucc: false; errMsg: string; }> {
        // Pre Flow
        let pre = await this.server.flows.preSendBufferFlow.exec({ conn: this, buf: buf, call: call });
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

        // Post Flow
        await this.server.flows.postSendBufferFlow.exec(pre);

        return { isSucc: true }
    }

    // Send Msg
    // sendMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T]) {
    //     let service = this.server.serviceMap.msgName2Service[msgName as string];
    //     if (!service) {
    //         throw new Error('Invalid msg name: ' + msgName);
    //     }

    //     let buf = TransportDataUtil.encodeMsg(this.server.tsbuffer, service, msg);
    //     if (this.server.options.encrypter) {
    //         buf = this.server.options.encrypter(buf);
    //     }
    //     return new Promise<void>((rs, rj) => {
    //         this.ws.send(buf, e => {
    //             e ? rj(e) : rs();
    //         })
    //     })
    // };

    close(reason?: string) {
        // 已连接 Close之
        this.ws.close(1000, reason);
    }
}