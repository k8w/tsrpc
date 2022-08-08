import { BaseClient } from "../base/BaseClient";
import { IWebSocketProxy } from "./IWebSocketProxy";
import { WsClientTransport } from "./WsClientTransport";

export class BaseWsClient extends BaseClient {

    declare protected _transport: WsClientTransport;

    constructor(ws: IWebSocketProxy) {
        super(new WsClientTransport(ws));
    }

    connect() {
        return this._transport.connect()
    }

}