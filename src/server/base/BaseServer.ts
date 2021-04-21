import 'colors';
import * as path from "path";
import { TSBuffer } from 'tsbuffer';
import { ApiReturn, ApiServiceDef, BaseServiceType, Logger, ServiceProto, TsrpcError, TsrpcErrorType } from 'tsrpc-proto';
import { Flow } from '../../models/Flow';
import { MsgHandlerManager } from '../../models/MsgHandlerManager';
import { nodeUtf8 } from '../../models/nodeUtf8';
import { MsgService, ServiceMap, ServiceMapUtil } from '../../models/ServiceMapUtil';
import { ParsedServerInput, TransportDataUtil } from '../../models/TransportDataUtil';
import { TerminalColorLogger } from '../models/TerminalColorLogger';
import { ApiCall } from './ApiCall';
import { BaseConnection } from './BaseConnection';
import { MsgCall } from './MsgCall';

export abstract class BaseServer<ServiceType extends BaseServiceType = BaseServiceType>{

    abstract readonly ApiCallClass: { new(options: any): ApiCall };
    abstract readonly MsgCallClass: { new(options: any): MsgCall };

    /**
     * Start server
     */
    abstract start(): Promise<void>;

    /**
     * Wait all requests finished and the stop server
     * @param immediately Stop server immediately, not waiting for the requests ending
     */
    abstract stop(): Promise<void>;

    protected _status: ServerStatus = ServerStatus.Closed;
    get status(): ServerStatus {
        return this._status;
    }

    // 配置及其衍生项
    readonly proto: ServiceProto<ServiceType>;
    readonly options: BaseServerOptions<ServiceType>;
    readonly tsbuffer: TSBuffer;
    readonly serviceMap: ServiceMap;
    readonly logger: Logger;

    /** 
     * Flows
     * 所有 Pre Flows 可以中断后续流程
     * 所有 Post Flows 不中断后续流程
     */
    readonly flows = {
        // Conn Flows
        postConnectFlow: new Flow<BaseConnection<ServiceType>>(),
        postDisconnectFlow: new Flow<{ conn: BaseConnection<ServiceType>, reason?: string }>(),

        // Buffer Flows
        preRecvBufferFlow: new Flow<{ conn: BaseConnection<ServiceType>, buf: Uint8Array }>(),
        preSendBufferFlow: new Flow<{ conn: BaseConnection<ServiceType>, buf: Uint8Array, call?: ApiCall }>(),

        // ApiCall Flows
        preApiCallFlow: new Flow<ApiCall>(),
        preApiReturnFlow: new Flow<{ call: ApiCall, return: ApiReturn<any> }>(),
        /** 不会中断后续流程 */
        postApiReturnFlow: new Flow<{ call: ApiCall, return: ApiReturn<any> }>(),
        /** 不会中断后续流程 */
        postApiCallFlow: new Flow<ApiCall>(),

        // MsgCall Flows
        preMsgCallFlow: new Flow<MsgCall>(),
        postMsgCallFlow: new Flow<MsgCall>(),
        preSendMsgFlow: new Flow<{ conn: BaseConnection<ServiceType>, service: MsgService, msg: any }>(),
        postSendMsgFlow: new Flow<{ conn: BaseConnection<ServiceType>, service: MsgService, msg: any }>(),
    } as const;

    // Handlers
    private _apiHandlers: { [apiName: string]: ((call: ApiCall) => any) | undefined } = {};
    // 多个Handler将异步并行执行
    private _msgHandlers: MsgHandlerManager = new MsgHandlerManager();

    private static _isUncaughtExceptionProcessed = false;
    static processUncaughtException(logger: Logger) {
        if (this._isUncaughtExceptionProcessed) {
            return;
        }
        this._isUncaughtExceptionProcessed = true;

        process.on('uncaughtException', e => {
            logger.error('[uncaughtException]', e);
        });

        process.on('unhandledRejection', e => {
            logger.error('[unhandledRejection]', e);
        });
    }

    constructor(proto: ServiceProto<ServiceType>, options: BaseServerOptions<ServiceType>) {
        this.proto = proto;
        this.options = options;

        this.tsbuffer = new TSBuffer(proto.types, {
            strictNullChecks: this.options.strictNullChecks,
            utf8Coder: nodeUtf8
        });
        this.serviceMap = ServiceMapUtil.getServiceMap(proto);
        this.logger = this.options.logger;

        // Process uncaught exception, so that Node.js process would not exit easily
        BaseServer.processUncaughtException(this.logger);

        // default flows onError handler
        this._setDefaultFlowOnError();
    }

    protected _setDefaultFlowOnError() {
        // API Flow Error: return [InternalServerError]
        this.flows.preApiCallFlow.onError = (e, call) => {
            if (e instanceof TsrpcError) {
                call.error(e)
            }
            else {
                this._onInternalServerError(e, call)
            }
        };
        this.flows.postApiCallFlow.onError = (e, call) => {
            if (!call.return) {
                if (e instanceof TsrpcError) {
                    call.error(e)
                }
                else {
                    this._onInternalServerError(e, call)
                }
            }
            else {
                call.logger.error('postApiCallFlow Error:', e);
            }
        };
        this.flows.preApiReturnFlow.onError = (e, last) => {
            last.call['_return'] = undefined;
            if (e instanceof TsrpcError) {
                last.call.error(e)
            }
            else {
                this._onInternalServerError(e, last.call)
            }
        }
        this.flows.postApiReturnFlow.onError = (e, last) => {
            if (!last.call.return) {
                if (e instanceof TsrpcError) {
                    last.call.error(e)
                }
                else {
                    this._onInternalServerError(e, last.call)
                }
            }
        }
    }

    protected _pendingApiCallNum = 0;

    // #region receive buffer process flow
    async _onRecvBuffer(conn: BaseConnection<ServiceType>, buf: Buffer) {
        // 非 OPENED 状态 停止接受新的请求
        if (this.status !== ServerStatus.Opened) {
            return;
        }

        // postRecvBufferFlow
        let opPreRecvBuffer = await this.flows.preRecvBufferFlow.exec({ conn: conn, buf: buf }, conn.logger);
        if (!opPreRecvBuffer) {
            return;
        }

        // Parse Call
        let opInput = TransportDataUtil.parseServerInput(this.tsbuffer, this.serviceMap, buf);
        if (!opInput.isSucc) {
            this._onInputBufferError(opInput.errMsg, conn, buf);
            return;
        }
        let call = this._makeCall(conn, opInput.result);

        if (call.type === 'api') {
            ++this._pendingApiCallNum;
            await this._onApiCall(call);
            if (--this._pendingApiCallNum === 0) {
                this._gracefulStop?.rs();
            }
        }
        else {
            await this._onMsgCall(call);
        }
    }

    protected _makeCall(conn: BaseConnection<ServiceType>, input: ParsedServerInput): ApiCall | MsgCall {
        if (input.type === 'api') {
            return new this.ApiCallClass({
                conn: conn,
                service: input.service,
                req: input.req,
                sn: input.sn,
            })
        }
        else {
            return new this.MsgCallClass({
                conn: conn,
                service: input.service,
                msg: input.msg
            })
        }
    }

    protected async _onApiCall(call: ApiCall) {
        let timeoutTimer = this.options.apiTimeout ? setTimeout(() => {
            if (!call.return) {
                call.error('Server Timeout', {
                    code: 'SERVER_TIMEOUT',
                    type: TsrpcErrorType.ServerError
                })
            }
            timeoutTimer = undefined;
        }, this.options.apiTimeout) : undefined;

        // Pre Flow
        let preFlow = await this.flows.preApiCallFlow.exec(call, call.logger);
        if (!preFlow || !preFlow.conn.isAlive) {
            if (timeoutTimer) {
                clearTimeout(timeoutTimer);
                timeoutTimer = undefined;
            }
            return;
        }
        call = preFlow;

        // exec ApiCall
        call.logger.log('[ApiReq]', this.options.logReqBody ? call.req : '');
        let handler = this._apiHandlers[call.service.name];
        // exec API handler
        if (handler) {
            try {
                await handler(call);
            }
            catch (e) {
                if (e instanceof TsrpcError) {
                    call.error(e);
                }
                else {
                    this._onInternalServerError(e, call);
                }
            }
        }
        // 未找到ApiHandler，且未进行任何输出
        else {
            call.error(`Unhandled API: ${call.service.name}`, { code: 'UNHANDLED_API', type: TsrpcErrorType.ServerError });

        }

        // Post Flow
        await this.flows.postApiCallFlow.exec(call, call.logger);

        if (timeoutTimer) {
            clearTimeout(timeoutTimer);
            timeoutTimer = undefined;
        }

        // Destroy call
        if (!call.return) {
            this._onInternalServerError({ message: 'API not return anything' }, call);
        }
    }

    protected async _onMsgCall(call: MsgCall) {
        // 收到Msg即可断开连接（短连接）
        if (call.conn.type === 'SHORT') {
            call.conn.close();
        }

        // Pre Flow
        let preFlow = await this.flows.preMsgCallFlow.exec(call, call.logger);
        if (!preFlow) {
            return;
        }
        call = preFlow;

        // MsgHandler
        call.logger.log('[Msg]', call.msg);
        let promises = this._msgHandlers.forEachHandler(call.service.name, call.logger, call);
        if (!promises.length) {
            this.logger.debug('[UNHANDLED_MSG]', call.service.name);
        }
        else {
            await Promise.all(promises);
        }

        // Post Flow
        await this.flows.postMsgCallFlow.exec(call, call.logger);
    }
    // #endregion    

    // #region Api/Msg handler register
    // API 只能实现一次
    implementApi<T extends keyof ServiceType['api']>(apiName: T, handler: ApiHandler<ServiceType['api'][T]['req'], ServiceType['api'][T]['res']>): void {
        if (this._apiHandlers[apiName as string]) {
            throw new Error('Already exist handler for API: ' + apiName);
        }
        this._apiHandlers[apiName as string] = handler;
        this.logger.log(`API implemented succ: [${apiName}]`);
    };

    async autoImplementApi(apiPath: string, apiNamePrefix?: string): Promise<{ succ: string[], fail: string[] }> {
        let apiServices = Object.values(this.serviceMap.apiName2Service) as ApiServiceDef[];
        let output: { succ: string[], fail: string[] } = { succ: [], fail: [] };

        // apiNamePrefix 末尾强制加/
        if (apiNamePrefix && !apiNamePrefix.endsWith('/')) {
            apiNamePrefix = apiNamePrefix + '/';
        }

        for (let svc of apiServices) {
            // 限定ServiceName前缀
            if (apiNamePrefix && !svc.name.startsWith(apiNamePrefix)) {
                continue;
            }

            //get matched Api
            let apiHandler: Function | undefined;

            // get api last name
            let match = svc.name.match(/^(.+\/)*(.+)$/);
            if (!match) {
                this.logger.warn('Invalid apiName: ' + svc.name);
                output.fail.push(svc.name);
                continue;
            }
            let handlerPath = match[1] || '';
            let handlerName = match[2];

            // 移除前缀
            if (apiNamePrefix) {
                handlerPath = handlerPath.substr(apiNamePrefix.length);
            }

            // try import
            let requireError: Error & { code: string } | undefined;
            let modulePath = path.resolve(apiPath, handlerPath, 'Api' + handlerName);
            try {
                let handlerModule = await import(modulePath);
                // ApiName同名
                apiHandler = handlerModule['Api' + handlerName] || handlerModule.default;
            }
            catch (e) {
                requireError = e;
            }

            if (!apiHandler) {
                output.fail.push(svc.name);
                let errMsg = `Auto implement api fail: [${svc.name}]`;

                // Fail info
                if (requireError) {
                    if (requireError.code === 'MODULE_NOT_FOUND') {
                        errMsg += `\n  |- Module not found: ${modulePath}`;
                    }
                    else {
                        errMsg += '\n  |- ' + requireError.message;
                    }
                }
                else {
                    errMsg += `\n  |- Cannot find export { ${'Api' + handlerName} } at: ${modulePath}`;
                }

                this.logger.warn(errMsg);
                continue;
            }

            this.implementApi(svc.name, apiHandler as any);
            output.succ.push(svc.name);
        }

        return output;
    }

    // Msg 可以重复监听
    listenMsg<T extends keyof ServiceType['msg']>(msgName: T, handler: MsgHandler<ServiceType['msg'][T]>): void {
        this._msgHandlers.addHandler(msgName as string, handler);
        this.logger.log(`Msg listened succ [${msgName}]`);
    };

    unlistenMsg<T extends keyof ServiceType['msg']>(msgName: T, handler?: Function): void {
        this._msgHandlers.removeHandler(msgName as string, handler);
        this.logger.log(`Msg unlistened succ [${msgName}]`);
    };
    // #endregion   

    /**
     * When the server cannot parse input buffer to api/msg call
     * By default, it will return "Input Buffer Error" .
     */
    protected _onInputBufferError(errMsg: string, conn: BaseConnection<ServiceType>, buf: Uint8Array) {
        conn.logger.error(`[${conn.ip}][InputBufferError] ${errMsg} length = ${buf.length}`, buf.subarray(0, 16))
        conn.close('Input Buffer Error');
    }

    /**
     * On error throwed inside (not TsrpcError)
     * By default, it will return a "Internal server error".
     * If `returnInnerError` is `true`, an `innerError` field would be returned.
     */
    _onInternalServerError(err: { message: string, stack?: string, name?: string }, call: ApiCall) {
        call.logger.error(err);
        call.error('Internal Server Error', {
            code: 'INTERNAL_ERR',
            type: TsrpcErrorType.ServerError,
            innerErr: call.conn.server.options.returnInnerError ? err.message : undefined
        });
    }

    protected _gracefulStop?: {
        rs: () => void
    };
    /**
     * 优雅的停止
     * 立即停止接收所有请求，直到所有现有请求都处理完，停止服务
     * @param maxWaitTime - 最长等待时间，undefined 或 0 代表无限
     */
    async gracefulStop(maxWaitTime?: number) {
        if (this._status !== ServerStatus.Opened) {
            throw new Error(`Cannot gracefulStop when server status is '${this._status}'.`);
        }

        this.logger.log('[GracefulStop] Start graceful stop, waiting all ApiCall finished...')
        this._status = ServerStatus.Closing;
        let promiseWaitApi = new Promise<void>(rs => {
            this._gracefulStop = {
                rs: rs
            };
        });

        return new Promise<void>(rs => {
            let maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
            if (maxWaitTime) {
                maxWaitTimer = setTimeout(() => {
                    maxWaitTimer = undefined;
                    if (this._gracefulStop) {
                        this._gracefulStop = undefined;
                        this.logger.log('Graceful stop timeout, stop the server directly.');
                        this.stop().then(() => { rs() });
                    }
                }, maxWaitTime);
            }

            promiseWaitApi.then(() => {
                this.logger.log('All ApiCall finished, continue stop server.');
                if (maxWaitTimer) {
                    clearTimeout(maxWaitTimer);
                    maxWaitTimer = undefined;
                }
                if (this._gracefulStop) {
                    this._gracefulStop = undefined;
                    this.stop().then(() => { rs() });
                }
            })
        })
    }

}

/** @public */
export interface BaseServerOptions<ServiceType extends BaseServiceType> {
    // TSBuffer相关
    /**
     * `undefined` 和 `null` 是否可以混合编码
     * 默认: `true`
     */
    strictNullChecks: boolean,

    /**
     * API 超时时间（毫秒）
     * 0 或 `undefined` 代表不限时
     * 默认：`30000`
     */
    apiTimeout: number | undefined,

    // LOG相关
    /**
     * Where the log is output to
     * @defaultValue `consoleColorLogger` (print to console with color)
     */
    logger: Logger;
    /** 
     * Print req body in log (may increase log size)
     * @defaultValue `true`
     */
    logReqBody: boolean;
    /** 
     * Print res body in log (may increase log size)
     * @defaultValue `true`
     */
    logResBody: boolean;

    /** 
     * 为true时将在控制台debug打印buffer信息
     */
    debugBuf?: boolean;

    /**
     * When "Internal server error" occured,
     * whether to return `innerError` to client. 
     * It depends on `NODE_ENV` by default. (be `false` when `NODE_ENV` is `production`, otherwise be `true`)
     */
    returnInnerError: boolean;
}

export const defaultBaseServerOptions: BaseServerOptions<any> = {
    strictNullChecks: true,
    apiTimeout: 30000,
    logger: new TerminalColorLogger,
    logReqBody: true,
    logResBody: true,
    returnInnerError: process.env['NODE_ENV'] !== 'production'
}

export type ApiHandler<Req = any, Res = any> = (call: ApiCall<Req, Res>) => void | Promise<void>;
export type MsgHandler<Msg = any> = (msg: MsgCall<Msg>) => void | Promise<void>;

export enum ServerStatus {
    Opening = 'OPENING',
    Opened = 'OPENED',
    Closing = 'CLOSING',
    Closed = 'CLOSED',
}