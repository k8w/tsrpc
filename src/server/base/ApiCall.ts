import { ApiReturn, BaseServiceType, Logger, TsrpcError, TsrpcErrorData, TsrpcErrorType } from "tsrpc-proto";
import { ApiService } from "../../models/ServiceMapUtil";
import { TransportDataUtil } from "../../models/TransportDataUtil";
import { PrefixLogger } from "../models/PrefixLogger";
import { BaseCall, BaseCallOptions } from "./BaseCall";

export interface ApiCallOptions<Req, ServiceType extends BaseServiceType> extends BaseCallOptions<ServiceType> {
    service: ApiService,
    /** 仅长连接才有，服务器透传 */
    sn?: number,
    /** Request Data */
    req: Req
}

export abstract class ApiCall<Req = any, Res = any, ServiceType extends BaseServiceType = any> extends BaseCall<ServiceType> {
    readonly type = 'api' as const;

    readonly service!: ApiService;
    readonly sn?: number;
    readonly req: Req;

    constructor(options: ApiCallOptions<Req, ServiceType>, logger?: Logger) {
        super(options, logger ?? new PrefixLogger({
            logger: options.conn.logger,
            prefixs: [`API${options.sn !== undefined ? `#${options.sn}` : ''}:${options.service.name}`]
        }));

        this.sn = options.sn;
        this.req = options.req;
    }

    private _return?: ApiReturn<Res>;
    /**
     * Sended Response Data
     * `undefined` means it have not sendRes yet
     */
    public get return(): ApiReturn<Res> | undefined {
        return this._return;
    }

    private _usedTime: number | undefined;
    /** Time from received req to send res */
    public get usedTime(): number | undefined {
        return this._usedTime;
    }

    succ(res: Res): Promise<void> {
        return this._prepareReturn({
            isSucc: true,
            res: res
        })
    }

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
            this._return = undefined;
            return;
        }
        ret = preFlow.return;

        // Do send!
        this._return = ret;
        let opSend = await (sendReturn ? sendReturn(ret) : this._sendReturn(ret));
        if (!opSend.isSucc) {
            return;
        }

        // record & log ret
        this._usedTime = Date.now() - this.startTime;
        if (ret.isSucc) {
            this.logger.log('[Res]', `${this.usedTime}ms`, this.server.options.logResBody ? ret.res : '');
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
            this.server.options.onApiInnerError({ message: opServerOutput.errMsg }, this);
            return opServerOutput;
        }

        let opSend = await this.conn.sendBuf(opServerOutput.buf);
        if (!opSend.isSucc) {
            this.error('sendBuf Error: ' + opSend.errMsg);
        }
        return opSend;
    }
}

export type SendReturnMethod<Res> = (ret: ApiReturn<Res>) => Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>;