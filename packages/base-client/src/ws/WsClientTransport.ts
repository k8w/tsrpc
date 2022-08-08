import { BaseTransport } from 'tsrpc-base';
import { IWebSocketProxy } from './IWebSocketProxy';

export class WsClientTransport extends BaseTransport {

    constructor(public ws: IWebSocketProxy) {
        super();
        ws.onMessage = e => {
            this.recvData(e.data)
        }
    }

    connect() {
        this.ws.connect();
    }
    
    close() {
        this.ws.close();
    }

    protected _doSendData() {
        this.ws.send()
    }

}