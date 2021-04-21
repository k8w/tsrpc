import { ApiReturn, BaseServiceType, TsrpcErrorType } from 'tsrpc-proto';
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
            if (ret.isSucc && this.server.options.jsonPrune) {
                let opPrune = this.server.tsbuffer.prune(ret.res, this.service.resSchemaId);
                if (!opPrune.isSucc) {
                    this._return = undefined;
                    this.server._onInternalServerError({ message: opPrune.errMsg }, this);
                    return opPrune;
                }
                ret.res = opPrune.pruneOutput;
            }
            this.server['_returnJSON'](this.conn, ret);
            return { isSucc: true };
        }
        else {
            return super._sendReturn(ret);
        }
    }

}