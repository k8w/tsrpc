import { IWebSocketProxy } from "tsrpc-base-client";
import { TsrpcError } from "tsrpc-proto";
import { MiniappObj, SocketTask } from "../models/MiniappObj";
import { WsClient } from "./WsClient";

export class WebSocketProxy implements IWebSocketProxy {
    options!: IWebSocketProxy['options'];
    miniappObj!: MiniappObj;
    client!: WsClient<any>;

    private _ws?: SocketTask;
    connect(server: string, protocols?: string[]): void {
        this._ws = this.miniappObj.connectSocket({
            ...this.client.options.connectSocketOptions,
            url: server,
            protocols: protocols
        });

        this._ws.onOpen(header => {
            this.options.onOpen();
        })

        this._ws.onError(res => {
            this.options.onError(res);
        })

        this._ws.onClose(e => {
            this.options.onClose(e.code, e.reason);
            this._ws = undefined;
        });

        this._ws.onMessage(e => {
            if (typeof e.data === 'string') {
                this.options.onMessage(e.data);
            }
            else {
                this.options.onMessage(new Uint8Array(e.data))
            }
        });
    }
    close(code?: number, reason?: string): void {
        this._ws?.close({
            code: code,
            reason: reason
        });
        this._ws = undefined;
    }
    send(data: string | Uint8Array): Promise<{ err?: TsrpcError | undefined; }> {
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

        return new Promise(rs => {
            this._ws!.send({
                data: sendData,
                success: () => { rs({}) },
                fail: res => {
                    rs({
                        err: new TsrpcError({
                            message: 'Network Error',
                            type: TsrpcError.Type.NetworkError,
                            innerErr: res
                        })
                    })
                }
            });
        })
    }

}