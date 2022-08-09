import { Logger } from "../models/Logger";
import { PrefixLogger } from "../models/PrefixLogger";
import { ApiService } from "../models/ServiceMapUtil";
import { ApiReturn, ApiReturnError, ApiReturnSucc } from "../proto/ApiReturn";
import { TsrpcError } from "../proto/TsrpcError";
import { BaseConnection, PROMISE_ABORTED } from "./BaseConnection";
import { ProtoInfo, TsrpcErrorData, TsrpcErrorType } from "./TransportDataSchema";

// 每一次 Api 调用都会生成一个 ApiCall（Server & Client）
// call.succ & call.error 可用于返回
// Server 的 call.succ / call.error ：sendReturn
// Client 的 call.succ / call.error ：拦截请求，本地 mock
// Call 分角色（Req or Ret）（Server or Client）

export class ApiCall<Req = any, Res = any, Conn extends BaseConnection = BaseConnection> {

    service!: ApiService;
    logger: Logger;
    return?: ApiReturn<Res>;

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
        })
        this.service = conn.serviceMap.apiName2Service[apiName]!;
    }

    protected _rsExecute?: (ret: ApiReturn<Res>) => void;;
    async execute(): Promise<ApiReturn<Res>> {
        // Get Service
        if (!this.service) {
            return this.error(`Undefined API name: ${this.apiName}`, {
                type: TsrpcErrorType.RemoteError
            });
        }

        // Log
        this.conn.options.logApi && this.logger.log(this.conn.chalk('[Req]', ['info']), this.conn.options.logReqBody ? this.req : '');

        // ApiCall timeout
        if (this.conn.options.apiCallTimeout) {
            this._startTimeout(this.conn.options.apiCallTimeout);
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

    async succ(res: Res): Promise<ApiReturnSucc<Res>> {
        this._stopTimeout();

        const ret: ApiReturn<Res> = { isSucc: true, res };
        this._rsExecute?.(ret);

        let op = await this.conn['_sendTransportData']({} as any);
        if (!op.isSucc) {
            // TODO
            // log encode error
            this.logger.error('Encode return error', 'res:', res, 'err:', op.err);
            await this._internalError(op.err);
            this.return;
        }

        this.logger.log(this.conn.chalk('[Res]', ['info']), this.conn.options.logResBody ? res : '');

        // this.conn['_sendTransportData']({type: 'ret'});
        // log [ApiRes]
        // TODO protoInfo
        throw new Error('TODO')
    }

    error(message: string, info?: Partial<TsrpcErrorData>): Promise<ApiReturnError>;
    error(err: TsrpcError): Promise<ApiReturnError>;
    error(errOrMsg: string | TsrpcError, data?: Partial<TsrpcErrorData>): Promise<ApiReturnError> {
        this._stopTimeout();

        const ret: ApiReturn<Res> = {
            isSucc: false,
            err: typeof errOrMsg === 'string' ? new TsrpcError(errOrMsg, data) : errOrMsg
        };
        this._rsExecute?.(ret);

        this.logger.log(this.conn.chalk('[Err]', [ret.err.type === TsrpcErrorType.ApiError ? 'info' : 'error']), ret.err);

        // this.conn['_sendTransportData']({type: 'ret'});
        // log [ApiErr]
        // this.conn['_sendTransportData']({
        //     type: 'ret',
        //     sn: transportData.sn,
        //     // TODO
        //     ret: { isSucc: false, err: new TsrpcError('xxx') },
        //     protoInfo: transportData.protoInfo && this._localProtoInfo
        // });
        throw new Error('TODO')
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

        this.logger.error(err);
        return this.error('Remote internal error', {
            code: 'INTERNAL_ERR',
            type: TsrpcErrorType.RemoteError,
            ...(this.conn.options.apiReturnInnerError ? { innerErr: err.message } : undefined)
        });
    }

}