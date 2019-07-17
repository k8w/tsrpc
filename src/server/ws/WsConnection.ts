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
import { TransportDataUtil } from '../../models/TransportDataUtil';

export interface WsConnectionOptions<ServiceType extends BaseServiceType, SessionType> {
    connId: number,
    server: WsServer<ServiceType, SessionType>,
    ws: WebSocket,
    httpReq: http.IncomingMessage,
    defaultSession: SessionType,
    onClose: (conn: WsConnection<ServiceType, SessionType>, code: number, reason: string) => void,
    onRecvData: (data: Buffer) => void;
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
            prefix: `[Conn#${options.connId}] [${this.ip}]`
        });
        // TODO
        // this.transporter = WsTransporter.pool.get({})

        // Init WS
        options.ws.onclose = e => { this.options.onClose(this, e.code, e.reason); };
        options.ws.onerror = e => { this.logger.warn('[CLIENT_ERR]', e.error); };
    }

    clean() {
        if (this.options.ws && this.options.ws.readyState === WebSocket.OPEN) {
            this.options.ws.close()
        }
        this.options.ws.onopen = this.options.ws.onclose = this.options.ws.onmessage = this.options.ws.onerror = undefined as any;

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
        let service = this.options.server.serviceMap.msgName2Service[msgName as string];
        if (!service) {
            throw new Error('Invalid msg name: ' + msgName);
        }

        let buf = TransportDataUtil.encodeMsg(this.options.server.tsbuffer, service, msg);
        return new Promise((rs, rj) => {
            this.options.ws.send(buf, e => {
                e ? rj(e) : rs();
            })
        })
    };

    sendApiSucc(call: ApiCall<any, any>, res: any) {
        if (call.res) {
            return;
        }

        call.res = res;
        call.logger.log('Succ', res)

        let buf = TransportDataUtil.encodeApiSucc(this.options.server.tsbuffer, call.service, res, call.sn);
        return new Promise((rs, rj) => {
            this.options.ws.send(buf, e => {
                e ? rj(e) : rs();
            })
        });
    }

    sendApiError(call: ApiCall<any, any>, message: string, info?: any) {
        if (call.res) {
            return;
        }

        let buf = TransportDataUtil.encodeApiError(call.service, message, info, call.sn)

        call.res = {
            isSucc: false,
            message: message,
            info: info
        };
        call.logger.log('Error', message, info);

        return new Promise((rs, rj) => {
            this.options.ws.send(buf, e => {
                e ? rj(e) : rs();
            })
        });
    }

    close() {
        // 已连接 Close之
        this.options.ws.close(1000, 'Server closed');
    }
}