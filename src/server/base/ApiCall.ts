import chalk from "chalk"
import { TSBuffer } from "tsbuffer"
import { ApiService, TransportDataUtil } from "tsrpc-base-client"
import {
  ApiReturn,
  BaseServiceType,
  ServerOutputData,
  TsrpcError,
  TsrpcErrorData,
  TsrpcErrorType,
} from "tsrpc-proto"
import { PrefixLogger } from "../models/PrefixLogger"
import { BaseCall, BaseCallOptions } from "./BaseCall"
import { BaseConnection } from "./BaseConnection"

export interface ApiCallOptions<Req, ServiceType extends BaseServiceType>
  extends BaseCallOptions<ServiceType> {
  /** Which service the Call is belong to */
  service: ApiService
  /** Only exists in long connection, it is used to associate request and response.
   * It is created by the client, and the server would return the same value in `ApiReturn`.
   */
  sn?: number
  /** Request Data */
  req: Req
}

/**
 * A call request by `client.callApi()`
 * @typeParam Req - Type of request
 * @typeParam Res - Type of response
 * @typeParam ServiceType - The same `ServiceType` to server, it is used for code auto hint.
 */
export abstract class ApiCall<
  Req = any,
  Res = any,
  ServiceType extends BaseServiceType = any,
> extends BaseCall<ServiceType> {
  readonly type = "api" as const

  /**
   * Which `ApiService` the request is calling for
   */
  readonly service!: ApiService
  /** Only exists in long connection, it is used to associate request and response.
   * It is created by the client, and the server would return the same value in `ApiReturn`.
   */
  readonly sn?: number
  /**
   * Request data from the client, type of it is checked by the framework already.
   */
  readonly req: Req

  constructor(options: ApiCallOptions<Req, ServiceType>, logger?: PrefixLogger) {
    super(
      options,
      logger ??
        new PrefixLogger({
          logger: options.conn.logger,
          prefixs: [
            `${chalk.cyan.underline(`[Api:${options.service.name}]`)}${options.sn !== undefined ? chalk.gray(` SN=${options.sn}`) : ""}`,
          ],
        })
    )

    this.sn = options.sn
    this.req = options.req
  }

  protected _return?: ApiReturn<Res>
  /**
   * Response Data that sent already.
   * `undefined` means no return data is sent yet. (Never `call.succ()` and `call.error()`)
   */
  public get return(): ApiReturn<Res> | undefined {
    return this._return
  }

  protected _usedTime: number | undefined
  /** Time from received req to send return data */
  public get usedTime(): number | undefined {
    return this._usedTime
  }

  /**
   * Send a successful `ApiReturn` with response data
   * @param res - Response data
   * @returns Promise resolved means the buffer is sent to kernel
   */
  succ(res: Res): Promise<void> {
    return this._prepareReturn({
      isSucc: true,
      res: res,
    })
  }

  /**
   * Send a error `ApiReturn` with a `TsrpcError`
   * @returns Promise resolved means the buffer is sent to kernel
   */
  error(message: string, info?: Partial<TsrpcErrorData>): Promise<void>
  error(err: TsrpcError): Promise<void>
  error(errOrMsg: string | TsrpcError, data?: Partial<TsrpcErrorData>): Promise<void> {
    let error: TsrpcError = typeof errOrMsg === "string" ? new TsrpcError(errOrMsg, data) : errOrMsg
    return this._prepareReturn({
      isSucc: false,
      err: error,
    })
  }

  protected async _prepareReturn(ret: ApiReturn<Res>): Promise<void> {
    if (this._return) {
      return
    }
    this._return = ret

    // Pre Flow
    let preFlow = await this.server.flows.preApiReturnFlow.exec(
      { call: this, return: ret },
      this.logger
    )
    // Stopped!
    if (!preFlow) {
      this.logger.debug("[preApiReturnFlow]", "Canceled")
      return
    }
    ret = preFlow.return

    // record & log ret
    this._usedTime = Date.now() - this.startTime
    if (ret.isSucc) {
      this.logger.log(
        chalk.green("[ApiRes]"),
        `${this.usedTime}ms`,
        this.server.options.logResBody ? ret.res : ""
      )
    } else {
      if (ret.err.type === TsrpcErrorType.ApiError) {
        this.logger.log(chalk.red("[ApiErr]"), `${this.usedTime}ms`, ret.err, "req=", this.req)
      } else {
        this.logger.error(chalk.red("[ApiErr]"), `${this.usedTime}ms`, ret.err, "req=", this.req)
      }
    }

    // Do send!
    this._return = ret
    let opSend = await this._sendReturn(ret)
    if (!opSend.isSucc) {
      if (opSend.canceledByFlow) {
        this.logger.debug(`[${opSend.canceledByFlow}]`, "Canceled")
      } else {
        this.logger.error("[SendDataErr]", opSend.errMsg)
        if (ret.isSucc || ret.err.type === TsrpcErrorType.ApiError) {
          this._return = undefined
          this.server.onInternalServerError({ message: opSend.errMsg, name: "SendReturnErr" }, this)
        }
      }

      return
    }

    // Post Flow
    await this.server.flows.postApiReturnFlow.exec(preFlow, this.logger)
  }

  protected async _sendReturn(ret: ApiReturn<Res>): ReturnType<SendReturnMethod<Res>> {
    // Encode
    let opServerOutput = ApiCall.encodeApiReturn(
      this.server.tsbuffer,
      this.service,
      ret,
      this.conn.dataType,
      this.sn
    )
    if (!opServerOutput.isSucc) {
      this.server.onInternalServerError(
        {
          message: opServerOutput.errMsg,
          stack: "  |- TransportDataUtil.encodeApiReturn\n  |- ApiCall._sendReturn",
        },
        this
      )
      return opServerOutput
    }

    let opSend = await this.conn.sendData(opServerOutput.output)
    if (!opSend.isSucc) {
      return opSend
    }
    return opSend
  }

  static encodeApiReturn(
    tsbuffer: TSBuffer,
    service: ApiService,
    apiReturn: ApiReturn<any>,
    type: "text",
    sn?: number
  ): EncodeApiReturnOutput<string>
  static encodeApiReturn(
    tsbuffer: TSBuffer,
    service: ApiService,
    apiReturn: ApiReturn<any>,
    type: "buffer",
    sn?: number
  ): EncodeApiReturnOutput<Uint8Array>
  static encodeApiReturn(
    tsbuffer: TSBuffer,
    service: ApiService,
    apiReturn: ApiReturn<any>,
    type: "json",
    sn?: number
  ): EncodeApiReturnOutput<object>
  static encodeApiReturn(
    tsbuffer: TSBuffer,
    service: ApiService,
    apiReturn: ApiReturn<any>,
    type: "text" | "buffer" | "json",
    sn?: number
  ):
    | EncodeApiReturnOutput<Uint8Array>
    | EncodeApiReturnOutput<string>
    | EncodeApiReturnOutput<object>
  static encodeApiReturn(
    tsbuffer: TSBuffer,
    service: ApiService,
    apiReturn: ApiReturn<any>,
    type: "text" | "buffer" | "json",
    sn?: number
  ):
    | EncodeApiReturnOutput<Uint8Array>
    | EncodeApiReturnOutput<string>
    | EncodeApiReturnOutput<object> {
    if (type === "buffer") {
      let serverOutputData: ServerOutputData = {
        sn: sn,
        serviceId: sn !== undefined ? service.id : undefined,
      }
      if (apiReturn.isSucc) {
        let op = tsbuffer.encode(apiReturn.res, service.resSchemaId)
        if (!op.isSucc) {
          return op
        }
        serverOutputData.buffer = op.buf
      } else {
        serverOutputData.error = apiReturn.err
      }

      let op = TransportDataUtil.tsbuffer.encode(serverOutputData, "ServerOutputData")
      return op.isSucc ? { isSucc: true, output: op.buf } : { isSucc: false, errMsg: op.errMsg }
    } else {
      apiReturn = { ...apiReturn }
      if (apiReturn.isSucc) {
        let op = tsbuffer.encodeJSON(apiReturn.res, service.resSchemaId)
        if (!op.isSucc) {
          return op
        }
        apiReturn.res = op.json
      } else {
        apiReturn.err = {
          ...apiReturn.err,
        }
      }
      let json = sn == undefined ? apiReturn : [service.name, apiReturn, sn]
      return { isSucc: true, output: type === "json" ? json : JSON.stringify(json) }
    }
  }
}

export type SendReturnMethod<Res> = (ret: ApiReturn<Res>) => ReturnType<BaseConnection["sendData"]>

export declare type EncodeApiReturnOutput<T> =
  | {
      isSucc: true
      /** Encoded binary buffer */
      output: T
      errMsg?: undefined
    }
  | {
      isSucc: false
      /** Error message */
      errMsg: string
      output?: undefined
    }
