import { BaseClient } from "../base/BaseClient";
import { WsClientTransport } from "../ws/WsClientTransport";
import { IWebRtcProxy } from "./IWebRtcProxy";

export class BaseUdpClient extends BaseClient {

    declare protected _transport: WsClientTransport;

    constructor(public wrtc: IWebRtcProxy) {
        super(new WsClientTransport(wrtc))
    }

    connect() {
        this._transport.connect();
    }

    close() {
        this._transport.close();
    }

}