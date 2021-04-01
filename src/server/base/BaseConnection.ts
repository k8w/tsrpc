import { Logger } from "tsrpc-proto";
import { PoolItem } from "../../models/Pool";
import { BaseServer } from "./BaseServer";

export interface BaseConnectionOptions {
    /** Server端自增 */
    id: string;
    ip: string,
    server: BaseServer
}

export abstract class BaseConnection {
    /** Long or Short connection */
    abstract readonly type: 'LONG' | 'SHORT';

    readonly id: string;
    readonly ip: string;
    readonly server: BaseServer;
    readonly logger: Logger;

    constructor(options: BaseConnectionOptions, logger: Logger) {
        this.id = options.id;
        this.ip = options.ip;
        this.server = options.server;
        this.logger = logger;
    }

    abstract get status(): ConnectionStatus;
    abstract close(reason?: string): void;

    destroy() {
        for (let key in this) {
            this[key] = undefined as any;
        }
    };
}

export enum ConnectionStatus {
    Opened = 'OPENED',
    Closing = 'CLOSING',
    Closed = 'CLOSED'
}