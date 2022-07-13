import { uint } from "tsrpc-proto";

export interface ReqDelData {
    dataIds: string[],
    force?: boolean
}

export interface ResDelData {
    deletedCount: uint
}