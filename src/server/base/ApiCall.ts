import { ApiService, TransportDataUtil } from "tsrpc-base-client";
import { ApiReturn, BaseServiceType, TsrpcError, TsrpcErrorData, TsrpcErrorType } from "tsrpc-proto";
import { PrefixLogger } from "../models/PrefixLogger";
import { BaseCall, BaseCallOptions } from "./BaseCall";

export interface ApiCallOptions<Req, ServiceType extends BaseServiceType> extends BaseCallOptions<ServiceType> {
    /** Which service the Call is belong to */
    service: ApiService,
    /** Only exists in long connection, it is used to associate request and response.
     * It is created by the client, and the server would return the same value in `ApiReturn`.
     */
    sn?: number,
    /** Request Data */
    req: Req
}

/**
 * A call request by `client.callApi()`
 * @typeParam Req - Type of request
 * @typeParam Res - Type of response
 * @typeParam ServiceType - The same `ServiceType` to server, it is used for code auto hint.
 */
export abstract class ApiCall<Req = any, Res = any, ServiceType extends BaseServiceType = any> extends BaseCall<ServiceType> {
    readonly type = 'api' as const;

    /**
     * Which `ApiService` the request is calling for
     */
    readonly service!: ApiService;
    /** Only exists in long connection, it is used to associate request and response.
     * It is created by the client, and the server would return the same value in `ApiReturn`.
     */
    readonly sn?: number;
    /**
     * Request data from the client, type of it is checked by the framework already.
     */
    readonly req: Req;

    constructor(options: ApiCallOptions<Req, ServiceType>, logger?: PrefixLogger) {
        super(options, logger ?? new PrefixLogger({
            logger: options.conn.logger,
            prefixs: [`[Api|${options.service.name}]${options.sn !== undefined ? ` SN=${options.sn}` : ''}`]
        }));

        this.sn = options.sn;
        this.req = options.req;
    }

    protected _return?: ApiReturn<Res>;
    /**
     * Response Data that sent already.
     * `undefined` means no return data is sent yet. (Never `call.succ()` and `call.error()`)
     */
    public get return(): ApiReturn<Res> | undefined {
        return this._return;
    }

    protected _usedTime: number | undefined;
    /** Time from received req to send return data */
    public get usedTime(): number | undefined {
        return this._usedTime;
    }

    /**
     * Send a successful `ApiReturn` with response data
     * @param res - Response data
     * @returns Promise resolved means the buffer is sent to kernel
     */
    succ(res: Res): Promise<void> {
        return this._prepareReturn({
            isSucc: true,
            res: res
        })
    }

    /**
     * Send a error `ApiReturn` with a `TsrpcError`
     * @returns Promise resolved means the buffer is sent to kernel
     */
    error(message: string, info?: Partial<TsrpcErrorData>): Promise<void>;
    error(err: TsrpcError): Promise<void>;
    error(errOrMsg: string | TsrpcError, data?: Partial<TsrpcErrorData>): Promise<void> {
        let error: TsrpcError = typeof errOrMsg === 'string' ? new TsrpcError(errOrMsg, data) : errOrMsg;
        return this._prepareReturn({
            isSucc: false,
            err: error
        })
    };


    protected async _prepareReturn(ret: ApiReturn<Res>, sendReturn?: SendReturnMethod<Res>): Promise<void> {
        if (this._return) {
            return;
        }
        this._return = ret;

        // Pre Flow
        let preFlow = await this.server.flows.preApiReturnFlow.exec({ call: this, return: ret }, this.logger);
        // Stopped!
        if (!preFlow) {
            return;
        }
        ret = preFlow.return;

        // Do send!
        this._return = ret;
        let opSend = await (sendReturn ? sendReturn(ret) : this._sendReturn(ret));
        if (!opSend.isSucc) {
            this.logger.log('[SendReturnErr]', opSend.errMsg, ret);
            return;
        }

        // record & log ret
        this._usedTime = Date.now() - this.startTime;
        if (ret.isSucc) {
            this.logger.log('[ApiRes]', `${this.usedTime}ms`, this.server.options.logResBody ? ret.res : '');
        }
        else {
            if (ret.err.type === TsrpcErrorType.ApiError) {
                this.logger.log('[ResErr]', `${this.usedTime}ms`, ret.err, 'req=', this.req);
            }
            else {
                this.logger.error(`[ResErr]`, `${this.usedTime}ms`, ret.err, 'req=', this.req)
            }
        }

        // Post Flow
        await this.server.flows.postApiReturnFlow.exec(preFlow, this.logger);
    }

    protected async _sendReturn(ret: ApiReturn<Res>): Promise<{ isSucc: true } | { isSucc: false, errMsg: string }> {
        // Encode
        let opServerOutput = TransportDataUtil.encodeApiReturn(this.server.tsbuffer, this.service, ret, this.sn);;
        if (!opServerOutput.isSucc) {
            this.server.onInternalServerError({ message: opServerOutput.errMsg, stack: '  |- TransportDataUtil.encodeApiReturn\n  |- ApiCall._sendReturn' }, this);
            return opServerOutput;
        }

        let opSend = await this.conn.sendBuf(opServerOutput.buf);
        if (!opSend.isSucc) {
            return opSend;
        }
        return opSend;
    }
}

export type SendReturnMethod<Res> = (ret: ApiReturn<Res>) => Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>;