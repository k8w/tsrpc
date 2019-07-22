import { PoolItem, Pool } from '../../models/Pool';
import * as http from "http";
import { HttpServer } from './HttpServer';
import { PrefixLogger } from '../Logger';
import { BaseServiceType } from 'tsrpc-proto';
import { ConnectionCloseReason } from '../BaseServer';

export interface HttpConnectionOptions<ServiceType extends BaseServiceType> {
    server: HttpServer<ServiceType>,
    ip: string;
    httpReq: http.IncomingMessage,
    httpRes: http.ServerResponse
}

export class HttpConnection<ServiceType extends BaseServiceType> extends PoolItem<HttpConnectionOptions<ServiceType>> {

    static pool = new Pool<HttpConnection<any>>(HttpConnection);

    logger!: PrefixLogger;

    get ip(): string {
        return this.options.ip;
    }

    get server(): HttpServer<ServiceType> {
        return this.options.server;
    }

    reset(options: this['options']) {
        super.reset(options);
        this.logger = PrefixLogger.pool.get({
            logger: options.server.logger,
            prefix: `[${options.ip}]`
        });
    }

    clean() {
        super.clean();
        this.logger.destroy();
        this.logger = undefined as any;
    }

    close(reason?: ConnectionCloseReason) {
        if (!this.options.httpRes.finished) {
            if (reason === 'Invalid Buffer') {
                this.options.httpRes.statusCode = 400;
            }
            this.options.httpRes.end();
        }
    }

    // Put into pool
    destroy() {
        this.close();
        HttpConnection.pool.put(this);
    }

}