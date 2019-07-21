import { BaseServiceType } from '../../proto/BaseServiceType';
import { WsConnection } from './WsConnection';
import { ApiCall, ApiCallOptions, MsgCall, MsgCallOptions } from '../BaseCall';
import { Pool } from '../../models/Pool';

export interface ApiCallWsOptions<ServiceType extends BaseServiceType, SessionType> extends ApiCallOptions {
    conn: WsConnection<ServiceType, SessionType>
}

export class ApiCallWs<Req = any, Res = any, ServiceType extends BaseServiceType = any, SessionType = any> extends ApiCall<ApiCallWsOptions<ServiceType, SessionType>, Req, Res> {

    static pool = new Pool<ApiCallWs>(ApiCallWs);

    conn!: WsConnection<ServiceType, SessionType>;

    reset(options: ApiCallWsOptions<ServiceType, SessionType>) {
        super.reset(options);
        this.conn = options.conn;
    }

    clean() {
        super.clean();
        this.conn.destroy();
        this.conn = undefined as any;
    }

    succ(data: Res): void {
        throw new Error("Method not implemented.");
    }

    error(message: string, info?: any): void {
        throw new Error("Method not implemented.");
    }

    destroy(): void {
        ApiCallWs.pool.put(this);
    }

}

export interface MsgCallWsOptions<ServiceType extends BaseServiceType, SessionType> extends MsgCallOptions {
    conn: WsConnection<ServiceType, SessionType>;
}
export class MsgCallWs<Msg = any, ServiceType extends BaseServiceType = any, SessionType = any> extends MsgCall<MsgCallWsOptions<ServiceType, SessionType>, Msg> {

    static pool = new Pool<MsgCallWs>(MsgCallWs);

    conn!: WsConnection<ServiceType, SessionType>;

    reset(options: MsgCallWsOptions<ServiceType, SessionType>) {
        super.reset(options);
        this.conn = options.conn;
    }

    clean() {
        super.clean();
        this.conn.destroy();
    }

    destroy(): void {
        MsgCallWs.pool.put(this);
    }

}

export type WsCall = ApiCallWs | MsgCallWs;