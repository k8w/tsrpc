import { Logger } from "tsrpc-proto";
import { PrefixLogger } from "../models/PrefixLogger";
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

    constructor(options: BaseConnectionOptions, logger?: Logger) {
        this.id = options.id;
        this.ip = options.ip;
        this.server = options.server;
        this.logger = logger ?? new PrefixLogger({
            logger: options.server.logger,
            prefixs: [`Conn#${options.id} ${options.ip}`]
        });
    }

    abstract get status(): ConnectionStatus;
    abstract close(reason?: string): void;

    abstract sendBuf(buf: Uint8Array): Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>;

    destroy() {
        if (this.status === ConnectionStatus.Opened) {
            this.close('DESTROY');
        }

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