import { ApiReturn, BaseServiceType } from 'tsrpc-proto';
import { ApiCall, ApiCallOptions } from '../base/ApiCall';
import { HttpConnection } from './HttpConnection';

export interface ApiCallHttpOptions<Req, ServiceType extends BaseServiceType> extends ApiCallOptions<Req, ServiceType> {
    conn: HttpConnection<ServiceType>;
}
export class ApiCallHttp<Req = any, Res = any, ServiceType extends BaseServiceType = any> extends ApiCall<Req, Res, ServiceType> {

    readonly conn!: HttpConnection<ServiceType>;

    constructor(options: ApiCallHttpOptions<Req, ServiceType>) {
        super(options);
    }

    protected async _sendReturn(ret: ApiReturn<Res>): Promise<{ isSucc: true } | { isSucc: false, errMsg: string }> {
        if (this.conn.isJSON) {
            if (this.server.options.jsonPrune) {
                // TODO Prune
            }
            this.server['_returnJSON'](this.conn, ret);
            return { isSucc: true };
        }
        else {
            return super._sendReturn(ret);
        }
    }

}