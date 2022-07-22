import { BaseConnection } from "./BaseConnection";

export interface MsgCall<MsgName extends keyof Conn['ServiceType']['msg'], Conn extends BaseConnection> {
    msg: Conn['ServiceType']['msg'][MsgName],
    msgName: MsgName,
    conn: Conn
}