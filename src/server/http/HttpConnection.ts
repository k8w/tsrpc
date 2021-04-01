import { PoolItem } from '../../models/Pool';
import * as http from "http";
import { HttpServer } from './HttpServer';
import { PrefixLogger } from '../models/PrefixLogger';
import { BaseServiceType } from 'tsrpc-proto';
import { HttpCall } from './HttpCall';
import { BaseConnection, BaseConnectionOptions } from '../base/BaseConnection';

export interface HttpConnectionOptions<ServiceType extends BaseServiceType> extends BaseConnectionOptions<HttpServer> {
    server: HttpServer<ServiceType>,
    ip: string;
    httpReq: http.IncomingMessage,
    httpRes: http.ServerResponse,
    call?: HttpCall;
}

export class HttpConnection<ServiceType extends BaseServiceType> extends BaseConnection<HttpServer, HttpConnectionOptions<ServiceType>> {

    reset(options: this['options']) {
        super.reset(options);
        this.logger = PrefixLogger.pool.get({
            logger: options.server.logger,
            prefixs: [`[${options.ip}]`]
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
        this.server['_poolConn'].put(this);
    }

}