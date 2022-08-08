import { BaseTransport } from 'tsrpc-base';
import { IHttpFetchProxy } from './IHttpFetchProxy';

export class HttpClientTransport extends BaseTransport {

    constructor(public fetch: IHttpFetchProxy) {
        super();
    }

    protected _doSendData() {
        this.fetch().then(v => {
            this.recvData({
                type: 'ret',
                sn: 111,
                ret: JSON.parse(v.body)
            })
        })
    }

}