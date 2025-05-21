import { ApiReturn, BaseServiceType, TsrpcErrorType } from "tsrpc-proto"
import { ApiCall, ApiCallOptions } from "../base/ApiCall"
import { HttpConnection } from "./HttpConnection"

export interface ApiCallHttpOptions<Req, ServiceType extends BaseServiceType>
  extends ApiCallOptions<Req, ServiceType> {
  conn: HttpConnection<ServiceType>
}
export class ApiCallHttp<
  Req = any,
  Res = any,
  ServiceType extends BaseServiceType = any,
> extends ApiCall<Req, Res, ServiceType> {
  readonly conn!: HttpConnection<ServiceType>

  constructor(options: ApiCallHttpOptions<Req, ServiceType>) {
    super(options)
  }

  protected async _sendReturn(
    ret: ApiReturn<Res>
  ): Promise<{ isSucc: true } | { isSucc: false; errMsg: string }> {
    if (this.conn.dataType === "text") {
      if (ret.isSucc) {
        this.conn.httpRes.statusCode = 200
      } else {
        this.conn.httpRes.statusCode = ret.err.type === TsrpcErrorType.ApiError ? 200 : 500
      }
    }
    return super._sendReturn(ret)
  }
}
