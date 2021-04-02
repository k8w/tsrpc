import { BaseServiceType } from 'tsrpc-proto';
import { ApiCall, ApiCallOptions } from '../base/ApiCall';
import { WsConnection } from './WsConnection';

export interface ApiCallWsOptions<Req, ServiceType extends BaseServiceType> extends ApiCallOptions<Req, ServiceType> {
    conn: WsConnection<ServiceType>
}

export class ApiCallWs<Req = any, Res = any, ServiceType extends BaseServiceType = any> extends ApiCall<Req, Res, ServiceType> {

    constructor(options: ApiCallWsOptions<Req, ServiceType>) {
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