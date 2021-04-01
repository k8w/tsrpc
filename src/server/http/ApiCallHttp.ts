import { ApiReturn } from '../../models/ApiReturn';
import { TransportDataUtil } from '../../models/TransportDataUtil';
import { ApiCall, ApiCallOptions } from '../base/ApiCall';
import { HttpConnection } from './HttpConnection';

export interface ApiCallHttpOptions<Req> extends ApiCallOptions<Req> {
    conn: HttpConnection;
}
export class ApiCallHttp<Req = any, Res = any> extends ApiCall<Req, Res> {

    constructor(options: ApiCallHttpOptions<Req>) {
        super(options);
    }

}