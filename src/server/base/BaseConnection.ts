import { Logger } from "tsrpc-proto";
import { PoolItem } from "../../models/Pool";

export type ConnectionCloseReason = 'INVALID_INPUT_BUFFER' | 'DATA_FLOW_BREAK' | 'NO_RES';

export interface BaseConnectionOptions<ServerType> {
    /** Server端自增 */
    id: string;
    ip: string,
    logger: Logger,
    server: ServerType
}

export abstract class BaseConnection<ServerType = any, ConnOptions extends BaseConnectionOptions<ServerType> = any> extends PoolItem<ConnOptions>{

    /** Long or Short connection */
    abstract get type(): 'LONG' | 'SHORT';

    get id() { return this.options.id };
    get ip() { return this.options.ip };
    get logger() { return this.options.logger };
    get server() { return this.options.server };

    abstract get status(): ConnectionStatus;
    abstract close(reason?: string): void;

}

export enum ConnectionStatus {
    Opened = 'OPENED',
    Closing = 'CLOSING',
    Closed = 'CLOSED'
}