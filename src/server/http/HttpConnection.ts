import { PoolItem, Pool } from '../../models/Pool';
import * as http from "http";
import { ApiCallHttp } from './HttpCall';
import { HttpServer } from './HttpServer';
import { TransportDataUtil } from '../../models/TransportDataUtil';
import { Logger, PrefixLogger } from '../Logger';
import { BaseServiceType } from '../../proto/BaseServiceType';

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

    get server(): HttpServer<ServiceType> {
        return this.options.server;
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

    // Put into pool
    destroy() {
        this.close();
        HttpConnection.pool.put(this);
    }

}