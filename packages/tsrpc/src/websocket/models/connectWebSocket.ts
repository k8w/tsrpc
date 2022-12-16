import { WebSocketConnectOptions, WebSocketConnectReturn } from "tsrpc-base-client";
import WebSocket from "ws";

export function connectWebSocket(opt: WebSocketConnectOptions): WebSocketConnectReturn {
    const ws = new WebSocket(opt.server, opt.protocols);
    ws.onopen = opt.onOpen;
    ws.onclose = e => {
        opt.onClose(e.code, e.reason);
    }
    ws.onerror = e => {
        opt.onError(e.error);
    }
    ws.onmessage = e => {
        if (e.data instanceof ArrayBuffer) {
            opt.onMessage(new Uint8Array(e.data));
        }
        else if (Array.isArray(e.data)) {
            opt.onMessage(Buffer.concat(e.data));
        }
        else {
            opt.onMessage(e.data);
        }
    }

    return {
        close(reason: string, code: number) {
            ws.close(code, reason);
        },
        send(data: string | Uint8Array) {
            return new Promise(rs => {
                ws.send(data, err => {
                    if (err) {
                        rs({
                            isSucc: false,
                            errMsg: 'WebSocket Send Error'
                        });
                        return;
                    }
                    rs({ isSucc: true });
                });
            })
        }
    }
}