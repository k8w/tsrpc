import { Logger } from "../models/Logger";
import { PrefixLogger } from "../models/PrefixLogger";
import { ApiService } from "../models/ServiceMapUtil";
import { ApiReturn } from "../proto/ApiReturn";
import { ProtoInfo, TsrpcErrorData, TsrpcErrorType } from "../proto/TransportDataSchema";
import { TsrpcError } from "../proto/TsrpcError";
import { BaseConnection, PROMISE_ABORTED } from "./BaseConnection";

// 每一次 Api 调用都会生成一个 ApiCall（Server & Client）
// call.succ & call.error 可用于返回
// Server 的 call.succ / call.error ：sendReturn
// Client 的 call.succ / call.error ：拦截请求，本地 mock
// Call 分角色（Req or Ret）（Server or Client）

export class ApiCall<Req = any, Res = any, Conn extends BaseConnection = BaseConnection> {

    logger: Logger;
    return?: ApiReturn<Res>;
    service!: ApiService;

    constructor(
        public readonly conn: Conn,
        public apiName: string,
        public readonly sn: number,
        public req: Req,
        public readonly protoInfo: ProtoInfo | undefined,
    ) {
        this.logger = new PrefixLogger({
            logger: conn.logger,
            prefixs: [conn.chalk(`[ApiCall] [#${sn}] [${apiName}]`, ['gray'])]
        });
    }

    protected _rsExecute?: (ret: ApiReturn<Res>) => void;;
    async execute(): Promise<ApiReturn<Res>> {
        // Get Service
        const service = this.conn.serviceMap.apiName2Service[this.apiName];
        if (!service) {
            return this.error(`Undefined API name: ${this.apiName}`, {
                type: TsrpcErrorType.RemoteError
            });
        }
        this.service = service;

        // Log
        this.conn.options.logApi && this.logger.log(this.conn.chalk('[Req]', ['info']), this.conn.options.logReqBody ? this.req : '');

        // ApiCall timeout
        if (this.conn.options.apiCallTimeout) {
            this._startTimeout(this.conn.options.apiCallTimeout);
        }

        // Validate
        if (!this.conn.options.skipDecodeValidate) {
            let vRes = this.conn.tsbuffer.validate(this.req, this.service.reqSchemaId);
            if (!vRes.isSucc) {
                return this.error(`[ReqTypeError] vRes.errMsg`, { type: TsrpcErrorType.RemoteError, code: 'REQ_TYPE_ERR' });
            }
        }

        // Pre Flow
        let preFlow = await this.conn.flows.preApiCallFlow.exec(this, this.logger);
        if (!preFlow) {
            this._stopTimeout();
            this.logger.debug(`${this.conn.chalk('[Canceled]', ['debug'])} Canceled by preApiCallFlow`);
            return PROMISE_ABORTED;
        }
        if (preFlow !== this) {
            return this._internalError({ message: 'You cannot recreate the ApiCall during Flow.' })
        }

        // Get Handler
        const handler = this.conn['_apiHandlers'][this.apiName];
        if (!handler) {
            return this.error(`Remote not implemented the API: ${this.apiName}`, {
                type: TsrpcErrorType.RemoteError,
                code: 'UNIMPLEMENTED_API'
            })
        }

        // Exec
        let promise = new Promise<ApiReturn<Res>>(rs => { this._rsExecute = rs })
        promise.then(() => { this._rsExecute = undefined });
        try {
            await handler(this);
        }
        catch (e: any) {
            this._internalError(e);
        }
        return promise;
    }

    async succ(res: Res): Promise<ApiReturn<Res>> {
        return this._sendReturn({ isSucc: true, res: res });
    }

    error(message: string, info?: Partial<TsrpcErrorData>): Promise<ApiReturn<Res>>;
    error(err: TsrpcError): Promise<ApiReturn<Res>>;
    error(errOrMsg: string | TsrpcError, data?: Partial<TsrpcErrorData>): Promise<ApiReturn<Res>> {
        return this._sendReturn({
            isSucc: false,
            err: typeof errOrMsg === 'string' ? new TsrpcError(errOrMsg, data) : errOrMsg
        });
    }

    protected async _sendReturn(ret: ApiReturn<Res>): Promise<ApiReturn<Res>> {
        if (this.return) {
            return this.return;
        }

        this._stopTimeout();
        this.return = ret;
        this._rsExecute?.(ret);

        // PreReturn Flow
        let pre = await this.conn.flows.preApiCallReturnFlow.exec(this as this & { return: ApiReturn<Res> }, this.logger);
        if (!pre) {
            return PROMISE_ABORTED;
        }
        ret = this.return = pre.return;

        // Send
        let op = await this.conn['_sendTransportData']({
            ...(ret.isSucc ? {
                type: 'res',
                body: ret.res,
                serviceName: this.service.name
            } : {
                type: 'err',
                err: ret.err,
            }),
            sn: this.sn,
            protoInfo: this.protoInfo ? this.conn['_localProtoInfo'] : undefined,
        }, undefined, this);
        if (!op.isSucc) {
            this.logger.error(`[SendReturnErr] ret:`, ret);
            this.logger.error(`[SendReturnErr]`, op.errMsg);
            this.return = undefined;
            return await this._internalError({ message: op.errMsg });
        }

        if (ret.isSucc) {
            this.logger.log(this.conn.chalk('[Res]', ['info']), this.conn.options.logResBody ? ret.res : '');
        }
        else {
            this.logger[ret.err.type === TsrpcErrorType.LocalError || ret.err.type === TsrpcErrorType.NetworkError ? 'error' : 'log'](
                this.conn.chalk('[Err]', [ret.err.type === TsrpcErrorType.ApiError ? 'info' : 'error']), ret.err
            );
        }

        // PostReturn Flow
        this.conn.flows.postApiCallReturnFlow.exec(this as this & { return: ApiReturn<Res> }, this.logger);

        return ret;
    }

    // Timeout
    protected _timeoutTimer?: ReturnType<typeof setTimeout>;
    protected _startTimeout(timeout: number) {
        this._timeoutTimer = setTimeout(() => {
            this._timeoutTimer = undefined;
            if (!this.return) {
                this.error('Remote Timeout', {
                    type: TsrpcErrorType.RemoteError,
                    code: 'REMOTE_TIMEOUT'
                })
            }
        }, timeout);
    }
    protected _stopTimeout() {
        if (this._timeoutTimer !== undefined) {
            clearTimeout(this._timeoutTimer);
            this._timeoutTimer = undefined;
        }
    }

    /**
     * Event when a uncaught error (except `TsrpcError`) is throwed.
     * By default, it will return a `TsrpcError` with message "Remote internal error".
     * If `apiReturnInnerError` is `true`, the original error would be returned as `innerErr` property.
     */
    protected _internalError(err: { message: string }) {
        if (err instanceof TsrpcError) {
            return this.error(err);
        }

        this.logger.error(this.conn.chalk('[InternalError]', ['error']), err);
        return this.error('Remote internal error', {
            code: 'INTERNAL_ERR',
            type: TsrpcErrorType.RemoteError,
            ...(this.conn.options.apiReturnInnerError ? { innerErr: err.message } : undefined)
        });
    }

}