import { BaseServiceType, ServiceProto, TsrpcError, TsrpcErrorType } from "tsrpc-proto";
import WebSocket from 'ws';
import { BaseClient, BaseClientOptions, defaultBaseClientOptions, PendingApiItem } from '../models/BaseClient';
import { TransportOptions } from "../models/TransportOptions";

export class WsClient<ServiceType extends BaseServiceType> extends BaseClient<ServiceType> {

    // Events
    /** 连接状态变化事件 */
    onStatusChange?: (newStatus: WsClientStatus) => void;
    /** 掉线（非人为断开连接） */
    onLostConnection?: () => void;

    readonly options!: WsClientOptions;
    constructor(proto: ServiceProto<ServiceType>, options?: Partial<WsClientOptions>) {
        super(proto, {
            ...defaultWsClientOptions,
            ...options
        });
        this.logger?.log('TSRPC WebSocket Client :', this.options.server);
    }

    protected async _sendBuf(buf: Uint8Array, options: TransportOptions, serviceId: number, pendingApiItem?: PendingApiItem): Promise<{ err?: TsrpcError; }> {
        return new Promise<{ err?: TsrpcError | undefined; }>(async rs => {
            if (!this._ws) {
                rs({
                    err: new TsrpcError('WebSocket is not connected', {
                        code: 'WS_NOT_OPEN',
                        type: TsrpcErrorType.ClientError
                    })
                });
                return;
            }

            // Send
            this._ws.send(buf, err => {
                if (err) {
                    this.logger?.error('WebSocket Send Error:', err);
                    rs({
                        err: new TsrpcError('Network Error', {
                            code: 'SEND_BUF_ERR',
                            type: TsrpcErrorType.NetworkError,
                            innerErr: err
                        })
                    });
                    return;
                }
                rs({});
            });
        });
    }

    get status(): WsClientStatus {
        if (this._promiseConnect) {
            return WsClientStatus.Opening
        }
        else if (this._ws) {
            if (this._ws.readyState === WebSocket.OPEN) {
                return WsClientStatus.Opened;
            }
            else if (this._ws.readyState === WebSocket.CLOSING) {
                return WsClientStatus.Closing;
            }
        }

        return WsClientStatus.Closed;
    }

    private _ws?: WebSocket;

    private _promiseConnect?: Promise<void>;
    async connect(): Promise<void> {
        // 已连接中
        if (this._promiseConnect) {
            return this._promiseConnect;
        }

        // 已连接成功
        if (this._ws) {
            return;
        }

        let ws = new (WebSocket as any)(this.options.server) as WebSocket;
        this.logger?.log(`Start connecting ${this.options.server}...`)
        this._promiseConnect = new Promise<void>((rs: Function, rj?: Function) => {
            ws.onopen = () => {
                this._promiseConnect = undefined;
                rs();
                rj = undefined;
                ws.onopen = undefined as any;
                this._ws = ws;
                this.logger?.log('Connected succ');
                this.onStatusChange && this.onStatusChange(WsClientStatus.Opened);
            };

            ws.onerror = e => {
                this.logger?.error('[WebSocket Error]', e.message);
                // 还在连接中，则连接失败
                if (rj) {
                    this._promiseConnect = undefined;
                    rj(new TsrpcError(e.message, {
                        type: TsrpcErrorType.NetworkError,
                        code: e.error?.code
                    }));
                }
            }

            ws.onclose = e => {
                if (rj) {
                    this._promiseConnect = undefined;
                    rj(new TsrpcError('Network Error', {
                        type: TsrpcErrorType.NetworkError,
                        code: e.reason
                    }));
                }

                // 清空WebSocket Listener
                ws.onopen = ws.onclose = ws.onmessage = ws.onerror = undefined as any;
                this._ws = undefined;

                this.onStatusChange?.(WsClientStatus.Closed);

                if (this._rsDisconnecting) {
                    this._rsDisconnecting();
                    this._rsDisconnecting = undefined;
                    this.logger?.log('Disconnected succ', `code=${e.code} reason=${e.reason}`);
                }
                // 已连接上 非主动关闭 触发掉线
                else if (rj) {
                    this.logger?.log(`Lost connection to ${this.options.server}`, `code=${e.code} reason=${e.reason}`);
                    this.onLostConnection?.();
                }
            };
        })

        ws.onmessage = e => {
            if (e.data instanceof Buffer) {
                this._onRecvBuf(e.data)
            }
            else if (e.data instanceof ArrayBuffer) {
                this._onRecvBuf(new Uint8Array(e.data));
            }
            else {
                this.logger?.log('[Unresolved Data]', e.data)
            }
        }

        this.onStatusChange?.(WsClientStatus.Opening);
        return this._promiseConnect;
    }

    private _rsDisconnecting?: () => void;
    async disconnect() {
        // 连接不存在
        if (!this._ws) {
            return;
        }

        this.logger?.log('Disconnecting...');
        return new Promise<void>(rs => {
            this._rsDisconnecting = rs;
            this._ws!.close();
        })
    }
}

const defaultWsClientOptions: WsClientOptions = {
    ...defaultBaseClientOptions,
    server: 'http://localhost:3000'
}

export interface WsClientOptions extends BaseClientOptions {
    /** Server URL */
    server: string;
}

export enum WsClientStatus {
    Opening = 'OPENING',
    Opened = 'OPENED',
    Closing = 'CLOSING',
    Closed = 'CLOSED'
}