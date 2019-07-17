import { BaseServiceType } from '../../proto/BaseServiceType';
import { WsConnection } from './WsConnection';
import { ApiCall, ApiCallOptions, MsgCall, MsgCallOptions } from '../BaseCall';
import { Pool } from '../../models/Pool';

export interface ApiCallWsOptions<ServiceType extends BaseServiceType> extends ApiCallOptions {
    conn: WsConnection<ServiceType>
}

export class ApiCallWs<Req = any, Res = any, ServiceType extends BaseServiceType = any> extends ApiCall<ApiCallWsOptions<ServiceType>, Req, Res> {

    static pool = new Pool<ApiCallWs>(ApiCallWs);

    conn!: WsConnection<ServiceType>;

    reset(options: ApiCallWsOptions<ServiceType>) {
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

export interface MsgCallWsOptions<ServiceType extends BaseServiceType> extends MsgCallOptions {
    conn: WsConnection<ServiceType>;
}
export class MsgCallWs<Msg = any, ServiceType extends BaseServiceType = any> extends MsgCall<MsgCallWsOptions<ServiceType>, Msg> {

    static pool = new Pool<MsgCallWs>(MsgCallWs);

    conn!: WsConnection<ServiceType>;

    reset(options: MsgCallWsOptions<ServiceType>) {
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