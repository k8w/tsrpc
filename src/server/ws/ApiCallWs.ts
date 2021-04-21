import { BaseServiceType } from 'tsrpc-proto';
import { ApiCall, ApiCallOptions } from '../base/ApiCall';
import { WsConnection } from './WsConnection';

export interface ApiCallWsOptions<Req, ServiceType extends BaseServiceType> extends ApiCallOptions<Req, ServiceType> {
    conn: WsConnection<ServiceType>
}

export class ApiCallWs<Req = any, Res = any, ServiceType extends BaseServiceType = any> extends ApiCall<Req, Res, ServiceType> {

    readonly conn!: WsConnection<ServiceType>;

    constructor(options: ApiCallWsOptions<Req, ServiceType>) {
        super(options);
    }

}