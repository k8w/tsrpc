import { IWebSocketProxy } from "tsrpc-base-client";
import { TsrpcError } from "tsrpc-proto";
import WebSocket from 'ws';

/**
 * @internal
 */
export class WebSocketProxy implements IWebSocketProxy {

    options!: IWebSocketProxy['options']

    private _ws?: WebSocket;
    connect(server: string): void {
        this._ws = new WebSocket(server);
        this._ws.onopen = this.options.onOpen;
        this._ws.onclose = e => {
            this.options.onClose(e.code, e.reason);
            this._ws = undefined;
        }
        this._ws.onerror = e => {
            this.options.onError(e.error);
        }
        this._ws.onmessage = e => {
            if (e.data instanceof ArrayBuffer) {
                this.options.onMessage(new Uint8Array(e.data));
            }
            else if (Array.isArray(e.data)) {
                this.options.onMessage(Buffer.concat(e.data));
            }
            else {
                this.options.onMessage(e.data);
            }
        }
    }
    close(code?: number, reason?: string): void {
        this._ws?.close(code, reason);
        this._ws = undefined;
    }
    send(data: string | Uint8Array): Promise<{ err?: TsrpcError | undefined; }> {
        return new Promise(rs => {
            this._ws?.send(typeof data === 'string' ? Buffer.from(data, 'utf-8') : data, err => {
                if (err) {
                    this.options.logger?.error('WebSocket Send Error:', err);
                    rs({
                        err: new TsrpcError('Network Error', {
                            code: 'SEND_BUF_ERR',
                            type: TsrpcError.Type.NetworkError,
                            innerErr: err
                        })
                    });
                    return;
                }
                rs({});
            });
        })
    }

}