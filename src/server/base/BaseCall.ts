import { ApiService, MsgService } from 'tsrpc-base-client';
import { BaseServiceType, Logger } from 'tsrpc-proto';
import { BaseConnection } from './BaseConnection';

export interface BaseCallOptions<ServiceType extends BaseServiceType> {
    /** Connection */
    conn: BaseConnection<ServiceType>,
    /** Which service the call is belong to */
    service: ApiService | MsgService
}

export abstract class BaseCall<ServiceType extends BaseServiceType> {
    readonly conn: BaseConnection<ServiceType>;
    readonly service: ApiService | MsgService;
    /** Time that server created the call */
    readonly startTime: number;
    readonly logger: Logger;

    constructor(options: BaseCallOptions<ServiceType>, logger: Logger) {
        this.conn = options.conn;
        this.service = options.service;
        this.startTime = Date.now();
        this.logger = logger;
    }

    get server(): this['conn']['server'] {
        return this.conn.server;
    }
}