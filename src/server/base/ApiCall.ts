import { EncodeOutput } from "tsbuffer";
import { Logger, TsrpcError, TsrpcErrorData } from "tsrpc-proto";
import { ApiReturn } from "../../models/ApiReturn";
import { ApiService } from "../../models/ServiceMapUtil";
import { TransportDataUtil } from "../../models/TransportDataUtil";
import { PrefixLogger } from "../models/PrefixLogger";
import { BaseCall, BaseCallOptions } from "./BaseCall";
import { BaseServer } from "./BaseServer";

export interface ApiCallOptions<Req> extends BaseCallOptions {
    service: ApiService,
    /** 仅长连接才有，服务器透传 */
    sn?: number,
    /** Request Data */
    req: Req
}

export abstract class ApiCall<Req = any, Res = any> extends BaseCall {
    readonly type = 'api' as const;

    readonly service!: ApiService;
    readonly sn?: number;
    readonly req: Req;

    constructor(options: ApiCallOptions<Req>, logger?: Logger) {
        super(options, logger ?? new PrefixLogger({
            logger: options.conn.logger,
            prefixs: [`Api:${options.service.name}${options.sn !== undefined ? ` SN=${options.sn}` : ''}`]
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

    error(err: TsrpcError): Promise<void>;
    error(message: string, info?: Partial<TsrpcErrorData>): Promise<void>;
    error(errOrMsg: string | TsrpcError, data?: Partial<TsrpcErrorData>): Promise<void> {
        let error: TsrpcError = typeof errOrMsg === 'string' ? new TsrpcError(errOrMsg, data) : errOrMsg;
        return this._prepareReturn({
            isSucc: false,
            err: error
        })
    };


    protected async _prepareReturn(ret: ApiReturn<Res>, sendReturn?: SendReturnMethod<Res>): Promise<void> {
        if (this.return) {
            this.logger.debug('API return duplicately.')
            return;
        }

        // Pre Flow
        let preFlow = await this.server.flows.preApiReturnFlow.exec({ call: this, return: ret });
        // Stopped!
        if (!preFlow) {
            return;
        }
        ret = preFlow.return;

        // Do send!        
        let opSend = await (sendReturn ?? this._sendReturn)(ret);
        if (!opSend.isSucc) {
            this.server.options.onApiInnerError(new Error(opSend.errMsg), this);
            return;
        }

        // record & log ret
        this._return = ret;
        this._usedTime = Date.now() - this.startTime;
        if (ret.isSucc) {
            this.logger.log('[Res]', `${this.usedTime}ms`, this.server.options.logResBody ? ret.res : '');
        }
        else {
            if (ret.err.type === 'ApiError') {
                this.logger.log('[ApiError]', `${this.usedTime}ms`, ret.err, 'req=', this.req);
            }
            else {
                this.logger.error(`[${ret.err.type}]`, `${this.usedTime}ms`, ret.err, 'req=', this.req)
            }
        }

        // Post Flow
        await this.server.flows.postApiReturnFlow.exec(preFlow);
    }

    protected async _sendReturn(ret: ApiReturn<Res>): Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>{
        // Encode
        let opServerOutput = TransportDataUtil.encodeApiReturn(this.server.tsbuffer, this.service, ret, this.sn);;
        if (!opServerOutput.isSucc) {
            return opServerOutput;
        }
        return this.conn.sendBuf(opServerOutput.buf);
    }
}

export type SendReturnMethod<Res> = (ret: ApiReturn<Res>) => Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>;