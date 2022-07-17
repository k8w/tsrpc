import { BaseConnection } from "./BaseConnection";

export class ApiCall<Req = any, Res = any, Conn = BaseConnection> {
    conn!: Conn;
}