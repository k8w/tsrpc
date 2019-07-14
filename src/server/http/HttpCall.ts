import { ApiCall, MsgCall } from '../BaseCall';
import { HttpConnection } from './HttpConnection';
import { BaseServiceType } from '../BaseServer';

export interface ApiCallHttp<Req = any, Res = any, ServiceType extends BaseServiceType = any> extends ApiCall<Req, Res> {
    conn: HttpConnection<ServiceType>;
    sn: number;
}

export interface MsgCallHttp<Msg = any, ServiceType extends BaseServiceType = any> extends MsgCall<Msg> {
    conn: HttpConnection<ServiceType>;
}

export type HttpCall = ApiCallHttp | MsgCallHttp;