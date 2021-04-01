import { Logger } from 'tsrpc-proto';
import { PoolItem } from '../../models/Pool';
import { ApiService, MsgService } from '../../models/ServiceMapUtil';
import { PrefixLogger } from '../models/PrefixLogger';
import { BaseConnection } from './BaseConnection';

export interface BaseCallOptions {
    /** Connection */
    conn: BaseConnection,
    service: ApiService | MsgService
}

export abstract class BaseCall {
    readonly conn: BaseConnection;
    readonly service: ApiService | MsgService;
    /** Time that server received the call */
    readonly startTime: number;
    readonly logger: Logger;

    constructor(options: BaseCallOptions, logger: Logger) {
        this.conn = options.conn;
        this.service = options.service;
        this.startTime = Date.now();
        this.logger = logger;
    }

    get server(): this['conn']['server'] {
        return this.conn.server;
    }

    destroy() {
        for (let key in this) {
            this[key] = undefined as any;
        }
    };
}