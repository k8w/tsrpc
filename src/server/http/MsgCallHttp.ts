import { MsgCall, MsgCallOptions } from "../base/MsgCall";
import { ApiCallHttp } from "./ApiCallHttp";
import { HttpConnection } from "./HttpConnection";

export interface MsgCallHttpOptions<Msg> extends MsgCallOptions<Msg> {
    conn: HttpConnection;
}
export class MsgCallHttp<Msg = any> extends MsgCall<Msg> {

    constructor(options: MsgCallHttpOptions<Msg>) {
        super(options);
    }

}

export type HttpCall = ApiCallHttp | MsgCallHttp;