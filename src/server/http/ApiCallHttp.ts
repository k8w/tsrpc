import { BaseServiceType } from 'tsrpc-proto';
import { ApiCall, ApiCallOptions } from '../base/ApiCall';
import { HttpConnection } from './HttpConnection';

export interface ApiCallHttpOptions<Req, ServiceType extends BaseServiceType> extends ApiCallOptions<Req, ServiceType> {
    conn: HttpConnection<ServiceType>;
}
export class ApiCallHttp<Req = any, Res = any, ServiceType extends BaseServiceType = any> extends ApiCall<Req, Res, ServiceType> {

    constructor(options: ApiCallHttpOptions<Req, ServiceType>) {
        super(options);
    }

}