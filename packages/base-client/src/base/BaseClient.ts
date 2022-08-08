// import { BaseTransport } from "tsrpc-base";
export class Base {
    protected callApi() { }
}
export class BaseClient extends Base {

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
