import { MsgCall } from "../..";
import { MsgCallOptions } from "../base/MsgCall";
import { WsConnection } from "./WsConnection";

export interface MsgCallWsOptions<Msg> extends MsgCallOptions<Msg> {
    conn: WsConnection;
}
export class MsgCallWs<Msg = any> extends MsgCall<Msg> {

    constructor(options: MsgCallWsOptions<Msg>) {
        super(options);
    }

}