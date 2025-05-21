import { ApiService, MsgService } from "tsrpc-base-client"
import { BaseServiceType } from "tsrpc-proto"
import { PrefixLogger } from "../models/PrefixLogger"
import { BaseConnection } from "./BaseConnection"

export interface BaseCallOptions<ServiceType extends BaseServiceType> {
  /** Connection */
  conn: BaseConnection<ServiceType>
  /** Which service the call is belong to */
  service: ApiService | MsgService
}

export abstract class BaseCall<ServiceType extends BaseServiceType> {
  readonly conn: BaseConnection<ServiceType>
  readonly service: ApiService | MsgService
  /** Time that server created the call */
  readonly startTime: number
  readonly logger: PrefixLogger

  constructor(options: BaseCallOptions<ServiceType>, logger: PrefixLogger) {
    this.conn = options.conn
    this.service = options.service
    this.startTime = Date.now()
    this.logger = logger
  }

  get server(): this["conn"]["server"] {
    return this.conn.server
  }
}
