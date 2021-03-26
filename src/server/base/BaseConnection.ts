import { Logger } from "tsrpc-proto";

export type ConnectionCloseReason = 'INVALID_INPUT_BUFFER' | 'DATA_FLOW_BREAK' | 'NO_RES';
export type BaseConnection = {
    isClosed: boolean;
    close: (reason?: ConnectionCloseReason) => void,
    ip: string,
    logger: Logger
}