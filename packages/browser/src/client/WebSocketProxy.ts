import { IWebSocketProxy } from "tsrpc-base-client";
import { TsrpcError } from "tsrpc-proto";

/**
 * @internal
 */
export class WebSocketProxy implements IWebSocketProxy {
    options!: IWebSocketProxy['options'];

    private _ws?: WebSocket;
    connect(server: string, protocols?: string[]): void {
        this._ws = new WebSocket(server, protocols);
        this._ws.binaryType = 'arraybuffer';

        this._ws.onopen = this.options.onOpen;
        this._ws.onerror = this.options.onError;
        this._ws.onclose = e => {
            this.options.onClose(e.code, e.reason);
            this._ws = undefined;
        }
        this._ws.onmessage = e => {
            if (e.data instanceof ArrayBuffer) {
                this.options.onMessage(new Uint8Array(e.data));
            }
            else if (typeof e.data === 'string') {
                this.options.onMessage(e.data);
            }
            else {
                this.options.logger?.warn('[Unresolved Recv]', e.data)
            }
        }
    }
    close(code?: number, reason?: string): void {
        this._ws?.close(code, reason);
        this._ws = undefined;
    }
    async send(data: string | Uint8Array): Promise<{ err?: TsrpcError | undefined; }> {
        try {
            let sendData: string | ArrayBuffer;
            if (typeof data === 'string') {
                sendData = data;
            }
            else {
                let buf = data;
                if (buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength) {
                    sendData = buf.buffer;
                }
                else {
                    sendData = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
                }
            }

            this._ws!.send(sendData);
            return {};
        }
        catch (err) {
            return {
                err: new TsrpcError('Network Error', {
                    code: 'SEND_BUF_ERR',
                    type: TsrpcError.Type.NetworkError,
                    innerErr: err
                })
            }
        }
    }

}