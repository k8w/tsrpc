import { PoolItem, Pool } from '../../models/Pool';
import * as http from "http";
import { HttpServer } from './HttpServer';
import { PrefixLogger } from '../Logger';
import { BaseServiceType } from 'tsrpc-proto';
import { ConnectionCloseReason, BaseConnection } from '../BaseServer';

export interface HttpConnectionOptions<ServiceType extends BaseServiceType> {
    server: HttpServer<ServiceType>,
    ip: string;
    httpReq: http.IncomingMessage,
    httpRes: http.ServerResponse
}

export class HttpConnection<ServiceType extends BaseServiceType> extends PoolItem<HttpConnectionOptions<ServiceType>> implements BaseConnection {

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
            // 有Reason代表是异常关闭
            if (reason) {
                this.logger.warn(`Conn closed unexpectly. url=${this.options.httpReq.url}, reason=${reason}`);
                this.options.httpRes.setHeader('X-TSRPC-Exception', reason);
            }
            this.options.httpRes.end();
        }
    }

    get isClosed(): boolean {
        return this.options.httpRes.finished;
    }

    // Put into pool
    destroy() {
        this.close();
        HttpConnection.pool.put(this);
    }

}