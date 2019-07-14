import * as http from "http";
import * as WebSocket from "ws";
import { Server, BaseServerCustomType } from './WsServer';
import { ApiCall } from '../BaseCall';
import { Logger } from '../Logger';
import { Transporter, ServiceMap, RecvData } from '../../models/Transporter';
import { TSBuffer } from "tsbuffer";

/**
 * 当前活跃的连接
 */
export class WebSocketConnection<ServerCustomType extends BaseServerCustomType = any> {

    get type() {
        return 'WebSocket' as const;
    }

    private _options!: WebSocketConnectionOptions<ServerCustomType>;
    server!: Server<ServerCustomType>;
    private _request!: http.IncomingMessage;
    connId!: number;
    ip!: string;
    session!: ServerCustomType['session'];
    logger!: Logger;

    private _ws!: WebSocket;
    private _transporter!: Transporter;

    private constructor() { }

    private static _pool: WebSocketConnection<any>[] = [];
    static getFromPool<ServerCustomType extends BaseServerCustomType>(options: WebSocketConnectionOptions<ServerCustomType>) {
        let item = this._pool.pop() as WebSocketConnection<ServerCustomType>;
        if (!item) {
            item = new WebSocketConnection<ServerCustomType>();
        }

        // RESET
        item._options = options;
        item.server = options.server;
        item._ws = options.ws;
        item._request = options.request;
        item.ip = item._getClientIp(options.request);
        item.connId = options.connId;
        item.session = options.session;
        item.logger = new Logger(() => [`Conn${item.connId}(${item.ip})`])
        item._transporter = Transporter.getFromPool('server', {
            ws: item._ws,
            proto: item.server.proto,
            onRecvData: item._onRecvData,
            tsbuffer: options.tsbuffer,
            serviceMap: options.serviceMap
        })

        // Init WS
        options.ws.onclose = e => { item._onClose(e.code, e.reason) };
        options.ws.onerror = e => { item._onError(e.error) };

        return item;
    }
    static putIntoPool(item: WebSocketConnection<any>) {
        if (this._pool.indexOf(item) > -1) {
            return;
        }

        // DISPOSE
        item._options =
            item.server =
            item._ws =
            item._request =
            item.ip =
            item.connId =
            item.session =
            item.logger =
            item._transporter = undefined as any;

        this._pool.push(item);
    }

    private _getClientIp(req: http.IncomingMessage) {
        var ipAddress;
        // The request may be forwarded from local web server.
        var forwardedIpsStr = req.headers['x-forwarded-for'] as string | undefined;
        if (forwardedIpsStr) {
            // 'x-forwarded-for' header may return multiple IP addresses in
            // the format: "client IP, proxy 1 IP, proxy 2 IP" so take the
            // the first one
            var forwardedIps = forwardedIpsStr.split(',');
            ipAddress = forwardedIps[0];
        }
        if (!ipAddress) {
            // If request was not forwarded
            ipAddress = req.connection.remoteAddress;
        }
        // Remove prefix ::ffff:
        return ipAddress ? ipAddress.replace(/^::ffff:/, '') : '';
    };

    // Listen Msg
    // listenMsg() { };
    // unlistenMsg() { };

    // Send Msg
    sendMsg<T extends keyof ServerCustomType['msg']>(msgName: T, msg: ServerCustomType['msg'][T]) {
        return this._transporter.sendMsg(msgName as string, msg);
    };

    sendApiSucc(call: ApiCall<any, any>, res: any) {
        if (call.res) {
            return;
        }

        this._transporter.sendApiSucc(call.service, call.sn, res)

        call.res = res;
        call.logger.log('Succ', res)
    }

    sendApiError(call: ApiCall<any, any>, message: string, info?: any) {
        if (call.res) {
            return;
        }

        let err = this._transporter.sendApiError(call.service, call.sn, message, info);

        call.res = err;
        call.logger.log('Error', message, info);
    }

    sendRaw(data: WebSocket.Data) {
        return new Promise((rs, rj) => {
            this._ws!.send(data, err => {
                err ? rj(err) : rs();
            });
        })
    }

    private _onRecvData = (data: RecvData) => {
        this._options.onRecvData(this, data);
    }

    close() {
        if (!this._ws) {
            return;
        }

        // 已连接 Close之
        this._ws.close(1000, 'Server closed');
    }

    private _onClose(code: number, reason: string) {
        this._ws.onopen = this._ws.onclose = this._ws.onmessage = this._ws.onerror = undefined as any;
        this._options.onClose && this._options.onClose(this, code, reason);
    }

    private _onError(e: Error) {
        console.warn('[CLIENT_ERR]', e);
    }
}

export interface WebSocketConnectionOptions<ServerCustomType extends BaseServerCustomType = any> {
    connId: number,
    server: Server<ServerCustomType>,
    ws: WebSocket,
    request: http.IncomingMessage,
    session: ServerCustomType['session'],
    tsbuffer: TSBuffer,
    serviceMap: ServiceMap,
    onClose: (conn: WebSocketConnection<ServerCustomType>, code: number, reason: string) => void,
    onRecvData: (conn: WebSocketConnection<ServerCustomType>, data: RecvData) => void;
}