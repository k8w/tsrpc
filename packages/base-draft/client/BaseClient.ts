import { BaseTransport } from "./BaseTransport";

export class BaseClient {
    protected _transport!: BaseTransport;

    callApi() {
        return this._transport.callApi();
    }

    implementClientApi() {
        return this._transport.implementApi()
    }

    sendMsg() {
        return this._transport.sendMsg();
    }
    onMsg() { }
    onceMsg() { }
    offMsg() { }
}

// client.onMsg('XXX', (msg, msgName, client)=>{

// });
// conn.onMsg('XXX', (msg, msgName, conn)=>{

// })
// server.onMsg('XXX', (msg, msgName, conn)=>{})