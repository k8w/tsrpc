import { Logger } from "tsrpc-proto";

export type ConnectionCloseReason = 'INVALID_INPUT_BUFFER' | 'DATA_FLOW_BREAK' | 'NO_RES';
export type BaseConnection = {
    /** Server端自增 */
    id: string;
    isClosed: boolean;
    close: (reason?: ConnectionCloseReason) => void,
    ip: string,
    logger: Logger
}