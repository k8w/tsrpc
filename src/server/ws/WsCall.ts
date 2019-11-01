import { BaseServiceType } from 'tsrpc-proto';
import { WsConnection } from './WsConnection';
import { ApiCall, ApiCallOptions, MsgCall, MsgCallOptions } from '../BaseCall';
import { Pool } from '../../models/Pool';
import { TransportDataUtil } from '../../models/TransportDataUtil';

export interface ApiCallWsOptions<ServiceType extends BaseServiceType, SessionType> extends ApiCallOptions {
    conn: WsConnection<ServiceType, SessionType>
}

export class ApiCallWs<Req = any, Res = any, ServiceType extends BaseServiceType = any, SessionType = any> extends ApiCall<Req, Res, ApiCallWsOptions<ServiceType, SessionType>> {

    static pool = new Pool<ApiCallWs>(ApiCallWs);

    conn!: WsConnection<ServiceType, SessionType>;

    reset(options: ApiCallWsOptions<ServiceType, SessionType>) {
        super.reset(options);
        this.conn = options.conn;
    }

    clean() {
        super.clean();
        this.conn = undefined as any;
    }

    async succ(res: Res): Promise<void> {
        if (this.res) {
            return;
        }

        let buf = TransportDataUtil.encodeApiSucc(this.conn.server.tsbuffer, this.service, res, this.sn);
        this.res = {
            isSucc: true,
            data: res,
            usedTime: Date.now() - this.startTime
        };

        return new Promise((rs, rj) => {
            this.conn.ws.send(buf, e => {
                e ? rj(e) : rs();
            })
        });
    }

    async error(message: string, info?: any): Promise<void> {
        if (this.res) {
            return;
        }

        // Error SN
        if (this.conn.server.options.showErrorSn) {
            message += ` [#${this.sn.toString(36)}]`;
        }

        let buf = TransportDataUtil.encodeApiError(this.service, message, info, this.sn);
        this.res = {
            isSucc: false,
            error: {
                message: message,
                info: info
            },
            usedTime: Date.now() - this.startTime
        };

        return new Promise((rs, rj) => {
            this.conn.ws.send(buf, e => {
                e ? rj(e) : rs();
            })
        });
    }

    destroy(): void {
        ApiCallWs.pool.put(this);
    }

}

export interface MsgCallWsOptions<ServiceType extends BaseServiceType, SessionType> extends MsgCallOptions {
    conn: WsConnection<ServiceType, SessionType>;
}
export class MsgCallWs<Msg = any, ServiceType extends BaseServiceType = any, SessionType = any> extends MsgCall<Msg, MsgCallWsOptions<ServiceType, SessionType>> {

    static pool = new Pool<MsgCallWs>(MsgCallWs);

    conn!: WsConnection<ServiceType, SessionType>;

    reset(options: MsgCallWsOptions<ServiceType, SessionType>) {
        super.reset(options);
        this.conn = options.conn;
    }

    clean() {
        super.clean();
        this.conn = undefined as any;
    }

    destroy(): void {
        MsgCallWs.pool.put(this);
    }

}

export type WsCall = ApiCallWs | MsgCallWs;