import { ApiCall, ApiCallOptions } from '../base/ApiCall';
import { WsConnection } from './WsConnection';

export interface ApiCallWsOptions<Req> extends ApiCallOptions<Req> {
    conn: WsConnection
}

export class ApiCallWs<Req = any, Res = any> extends ApiCall<Req, Res> {

    constructor(options: ApiCallWsOptions<Req>) {
        super(options);
    }


    // async succ(res: Res): Promise<void> {
    //     if (this.res) {
    //         return;
    //     }

    //     let buf = TransportDataUtil.encodeApiSucc(this.conn.server.tsbuffer, this.service, res, this.sn);
    //     this.conn.server.options.debugBuf && this.logger.debug('[SendBuf]', buf);
    //     if (this.conn.server.options.encrypter) {
    //         buf = this.conn.server.options.encrypter(buf);
    //         this.conn.server.options.debugBuf && this.logger.debug('[EncryptedBuf]', buf);
    //     }

    //     this.options.res = {
    //         isSucc: true,
    //         data: res,
    //         usedTime: Date.now() - this.startTime
    //     };

    //     return new Promise((rs, rj) => {
    //         this.conn.ws.send(buf, e => {
    //             e ? rj(e) : rs();
    //         })
    //     });
    // }

}