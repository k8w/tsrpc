import * as http from "http";
import { BaseConnection, BaseConnectionOptions, ConnectionStatus } from '../base/BaseConnection';
import { PrefixLogger } from '../models/PrefixLogger';
import { HttpServer } from './HttpServer';

export interface HttpConnectionOptions extends BaseConnectionOptions {
    // server: HttpServer,
    httpReq: http.IncomingMessage,
    httpRes: http.ServerResponse
}

export class HttpConnection extends BaseConnection {
    readonly type = 'SHORT';

    readonly httpReq: http.IncomingMessage;
    readonly httpRes: http.ServerResponse;

    constructor(options: HttpConnectionOptions) {
        super(options, new PrefixLogger({
            logger: options.server.logger,
            prefixs: [`[${options.ip}]`]
        }));

        this.httpReq = options.httpReq;
        this.httpRes = options.httpRes;
    }


    private _status: ConnectionStatus = ConnectionStatus.Opened;
    public get status(): ConnectionStatus {
        // TODO
        if (this.httpRes.writableEnded) {
            return ConnectionStatus.Closed;
        }
        this.httpRes.socket
        return ConnectionStatus.Opened;
    }

    close(reason?: string): void {
        if (!this.httpRes.writableEnded) {
            // 有Reason代表是异常关闭
            if (reason) {
                this.logger.warn(`Conn closed unexpectly. url=${this.httpReq.url}, reason=${reason}`);
                this.httpRes.setHeader('X-TSRPC-Exception', reason);
            }
            this.httpRes.end(reason);
        }
    }
}