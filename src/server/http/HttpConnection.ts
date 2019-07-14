import { PoolItem, Pool } from '../../models/Pool';
import * as http from "http";
import { ApiCallHttp } from './HttpCall';
import { HttpServer } from './HttpServer';
import { BaseServiceType } from '../BaseServer';
import { TransportDataUtil } from '../../models/TransportDataUtil';
import { Logger, PrefixLogger } from '../Logger';

export interface HttpConnectionOptions<ServiceType extends BaseServiceType> {
    server: HttpServer<ServiceType>;
    logger: PrefixLogger;
    ip: string;
    req: http.IncomingMessage,
    res: http.ServerResponse
}

export class HttpConnection<ServiceType extends BaseServiceType> extends PoolItem<HttpConnectionOptions<ServiceType>> {

    static pool = new Pool<HttpConnection<any>>(HttpConnection);

    get ip(): string {
        return this.options.ip;
    }

    get logger(): Logger {
        return this.options.logger;
    }

    sendApiSucc(call: ApiCallHttp<any, any>, res: any) {
        if (call.res) {
            return;
        }

        let buf = TransportDataUtil.encodeApiSucc(this.options.server.tsbuffer, call.service, res);
        this.options.res.end(buf);

        call.res = {
            isSucc: true,
            data: res
        };
        call.logger.log('[API_SUCC]', res)
    }

    sendApiError(call: ApiCallHttp<any, any>, message: string, info?: any) {
        if (call.res) {
            return;
        }

        let buf = TransportDataUtil.encodeApiError(call.service, message, info);
        this.options.res.end(buf);

        call.res = {
            isSucc: false,
            message: message,
            info: info
        };
        call.logger.warn('[API_ERR]', message, info);
    }

    clean() {
        PrefixLogger.pool.put(this.options.logger);
        super.clean();
    }

    close() {
        if (!this.options.res.finished) {
            this.options.res.end();
        }
    }
}