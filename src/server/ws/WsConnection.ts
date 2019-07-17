import * as http from "http";
import * as WebSocket from "ws";
import { ApiCall } from '../BaseCall';
import { PrefixLogger } from '../Logger';
import { RecvData, WsTransporter } from '../../models/WsTransporter';
import { TSBuffer } from "tsbuffer";
import { BaseServiceType } from "../../proto/BaseServiceType";
import { WsServer } from "./WsServer";
import { PoolItem, Pool } from '../../models/Pool';
import { ServiceMap } from "../../models/ServiceMapUtil";
import { HttpUtil } from "../../models/HttpUtil";

export interface WsConnectionOptions<ServiceType extends BaseServiceType, SessionType> {
    connId: number,
    server: WsServer<ServiceType, SessionType>,
    ws: WebSocket,
    httpReq: http.IncomingMessage,
    defaultSession: SessionType,
    tsbuffer: TSBuffer,
    serviceMap: ServiceMap,
    onClose: (conn: WsConnection<ServiceType, SessionType>, code: number, reason: string) => void,
    onRecvData: (data: Buffer) => void;
    // onInput: (conn: WsConnection<ServiceType, SessionType>, input: ParsedServerInput) => void;
}

/**
 * 当前活跃的连接
 */
export class WsConnection<ServiceType extends BaseServiceType = any, SessionType = any> extends PoolItem<WsConnectionOptions<ServiceType, SessionType>> {

    static pool = new Pool<WsConnection>(WsConnection);

    ip!: string;
    session!: SessionType;
    logger!: PrefixLogger;
    transporter!: WsTransporter;

    get connId() {
        return this.options.connId;
    }

    reset(options: this['options']) {
        super.reset(options);

        this.ip = HttpUtil.getClientIp(this.options.httpReq);
        this.session = Object.merge({}, options.defaultSession);
        this.logger = PrefixLogger.pool.get({
            logger: this.options.server.logger,
            prefix: `[Conn#${options.connId}] [${options.ip}]`
        });
        // TODO
        // this.transporter = WsTransporter.pool.get({})

        // Init WS
        options.ws.onclose = e => { this._onClose(e.code, e.reason) };
        options.ws.onerror = e => { this._onError(e.error) };
    }

    clean() {
        if (this.options.ws && this.options.ws.readyState === WebSocket.OPEN) {
            this.options.ws.close()
        }

        super.clean();
        this.logger.destroy();
        this.transporter.destroy();
        this.ip = this.session = this.logger = this.transporter = undefined as any;
    }

    destroy() {
        WsConnection.pool.put(this);
    }

    // Send Msg
    sendMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T]) {
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