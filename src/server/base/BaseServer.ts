import { ObjectId } from "bson";
import chalk from "chalk";
import * as path from "path";
import { TSBuffer } from 'tsbuffer';
import { Counter, Flow, getCustomObjectIdTypes, MsgHandlerManager, MsgService, ParsedServerInput, ServiceMap, ServiceMapUtil, TransportDataUtil } from 'tsrpc-base-client';
import { ApiReturn, ApiServiceDef, BaseServiceType, Logger, ServerOutputData, ServiceProto, TsrpcError, TsrpcErrorType } from 'tsrpc-proto';
import { ApiCallInner } from "../inner/ApiCallInner";
import { InnerConnection } from "../inner/InnerConnection";
import { TerminalColorLogger } from '../models/TerminalColorLogger';
import { ApiCall } from './ApiCall';
import { BaseConnection } from './BaseConnection';
import { MsgCall } from './MsgCall';

/**
 * Abstract base class for TSRPC Server.
 * Implement on a transportation protocol (like HTTP WebSocket) by extend it.
 * @typeParam ServiceType - `ServiceType` from generated `proto.ts`
 */
export abstract class BaseServer<ServiceType extends BaseServiceType = BaseServiceType>{

    abstract readonly ApiCallClass: { new(options: any): ApiCall };
    abstract readonly MsgCallClass: { new(options: any): MsgCall };

    /**
     * Start the server
     * @throws
     */
    abstract start(): Promise<void>;

    /**
     * Stop server immediately, not waiting for the requests ending.
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

    protected _connIdCounter = new Counter(1);

    /** 
     * Flow is a specific concept created by TSRPC family.
     * All pre-flow can interrupt latter behaviours.
     * All post-flow can NOT interrupt latter behaviours.
     */
    readonly flows = {
        // Conn Flows
        /** After the connection is created */
        postConnectFlow: new Flow<BaseConnection<ServiceType>>(),
        /** After the connection is disconnected */
        postDisconnectFlow: new Flow<{ conn: BaseConnection<ServiceType>, reason?: string }>(),

        // Buffer Flows
        /**
         * Before processing the received buffer, usually be used to encryption / decryption.
         * Return `null | undefined` would ignore the buffer.
         */
        preRecvBufferFlow: new Flow<{ conn: BaseConnection<ServiceType>, buf: Uint8Array }>(),
        /**
         * Before send out buffer to network, usually be used to encryption / decryption.
         * Return `null | undefined` would not send the buffer.
         */
        preSendBufferFlow: new Flow<{ conn: BaseConnection<ServiceType>, buf: Uint8Array, call?: ApiCall }>(),

        // ApiCall Flows
        /**
         * Before a API request is send.
         * Return `null | undefined` would cancel the request.
         */
        preApiCallFlow: new Flow<ApiCall>(),
        /**
         * Before return the `ApiReturn` to the client.
         * It may be used to change the return value, or return `null | undefined` to abort the request.
         */
        preApiReturnFlow: new Flow<{ call: ApiCall, return: ApiReturn<any> }>(),
        /** 
         * After the `ApiReturn` is send.
         * return `null | undefined` would NOT interrupt latter behaviours.
         */
        postApiReturnFlow: new Flow<{ call: ApiCall, return: ApiReturn<any> }>(),
        /**
         * After the api handler is executed.
         * return `null | undefined` would NOT interrupt latter behaviours.
         */
        postApiCallFlow: new Flow<ApiCall>(),

        // MsgCall Flows
        /**
         * Before handle a `MsgCall`
         */
        preMsgCallFlow: new Flow<MsgCall>(),
        /**
         * After handlers of a `MsgCall` are executed.
         * return `null | undefined` would NOT interrupt latter behaviours.
         */
        postMsgCallFlow: new Flow<MsgCall>(),
        /**
         * Before send out a message.
         * return `null | undefined` would NOT interrupt latter behaviours.
         */
        preSendMsgFlow: new Flow<{ conn: BaseConnection<ServiceType>, service: MsgService, msg: any }>(),
        /**
         * After send out a message.
         * return `null | undefined` would NOT interrupt latter behaviours.
         */
        postSendMsgFlow: new Flow<{ conn: BaseConnection<ServiceType>, service: MsgService, msg: any }>(),
    } as const;

    // Handlers
    private _apiHandlers: { [apiName: string]: ApiHandler<any> | undefined } = {};
    // 多个Handler将异步并行执行
    private _msgHandlers: MsgHandlerManager = new MsgHandlerManager();

    private static _isUncaughtExceptionProcessed = false;
    /**
     * It makes the `uncaughtException` and `unhandledRejection` not lead to the server stopping.
     * @param logger 
     * @returns 
     */
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

        this.tsbuffer = new TSBuffer({
            ...proto.types,
            // Support mongodb/ObjectId
            ...getCustomObjectIdTypes(ObjectId)
        }, {
            strictNullChecks: this.options.strictNullChecks
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
                this.onInternalServerError(e, call)
            }
        };
        this.flows.postApiCallFlow.onError = (e, call) => {
            if (!call.return) {
                if (e instanceof TsrpcError) {
                    call.error(e)
                }
                else {
                    this.onInternalServerError(e, call)
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
                this.onInternalServerError(e, last.call)
            }
        }
        this.flows.postApiReturnFlow.onError = (e, last) => {
            if (!last.call.return) {
                if (e instanceof TsrpcError) {
                    last.call.error(e)
                }
                else {
                    this.onInternalServerError(e, last.call)
                }
            }
        }
    }

    protected _pendingApiCallNum = 0;

    // #region receive buffer process flow
    /**
     * Process the buffer, after the `preRecvBufferFlow`.
     */
    async _onRecvBuffer(conn: BaseConnection<ServiceType>, buf: Buffer) {
        // 非 OPENED 状态 停止接受新的请求
        if (this.status !== ServerStatus.Opened) {
            return;
        }

        this.options.debugBuf && conn.logger.debug('[RecvBuf]', `length=${buf.length}`, buf);

        // postRecvBufferFlow
        let opPreRecvBuffer = await this.flows.preRecvBufferFlow.exec({ conn: conn, buf: buf }, conn.logger);
        if (!opPreRecvBuffer) {
            return;
        }

        // Parse Call
        let opInput = TransportDataUtil.parseServerInput(this.tsbuffer, this.serviceMap, buf);
        if (!opInput.isSucc) {
            this.onInputBufferError(opInput.errMsg, conn, buf);
            return;
        }
        let call = this._makeCall(conn, opInput.result);

        if (call.type === 'api') {
            await this._handleApiCall(call);
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

    protected async _handleApiCall(call: ApiCall) {
        ++this._pendingApiCallNum;
        await this._onApiCall(call);
        if (--this._pendingApiCallNum === 0) {
            this._gracefulStop?.rs();
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
        if (!preFlow) {
            if (timeoutTimer) {
                clearTimeout(timeoutTimer);
                timeoutTimer = undefined;
            }
            return;
        }
        call = preFlow;

        // exec ApiCall
        call.logger.log('[ApiReq]', this.options.logReqBody ? call.req : '');
        let { handler } = await this.getApiHandler(call.service, this._delayImplementApiPath, call.logger);
        // exec API handler
        if (handler) {
            try {
                await handler(call);
            }
            catch (e: any) {
                if (e instanceof TsrpcError) {
                    call.error(e);
                }
                else {
                    this.onInternalServerError(e, call);
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
        // if (!call.return) {
        //     this.onInternalServerError({ message: 'API not return anything' }, call);
        // }
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
        this.options.logMsg && call.logger.log('[RecvMsg]', call.msg);
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
    /**
     * Associate a `ApiHandler` to a specific `apiName`.
     * So that when `ApiCall` is receiving, it can be handled correctly.
     * @param apiName 
     * @param handler 
     */
    implementApi<Api extends keyof ServiceType['api'], Call extends ApiCall<ServiceType['api'][Api]['req'], ServiceType['api'][Api]['res']>>(apiName: Api, handler: ApiHandler<Call>): void {
        if (this._apiHandlers[apiName as string]) {
            throw new Error('Already exist handler for API: ' + apiName);
        }
        this._apiHandlers[apiName as string] = handler;
        this.logger.log(`API implemented succ: [${apiName}]`);
    };

    /** 用于延迟注册 API */
    protected _delayImplementApiPath?: string;

    /**
     * Auto call `imeplementApi` by traverse the `apiPath` and find all matched `PtlXXX` and `ApiXXX`.
     * It is matched by checking whether the relative path and name of an API is consistent to the service name in `serviceProto`.
     * Notice that the name prefix of protocol is `Ptl`, of API is `Api`.
     * For example, `protocols/a/b/c/PtlTest` is matched to `api/a/b/c/ApiTest`.
     * @param apiPath Absolute path or relative path to `process.cwd()`.
     * @returns 
     */
    async autoImplementApi(apiPath: string, delay?: boolean): Promise<{ succ: string[], fail: string[] }> {
        let apiServices = Object.values(this.serviceMap.apiName2Service) as ApiServiceDef[];
        let output: { succ: string[], fail: string[] } = { succ: [], fail: [] };

        if (delay) {
            this._delayImplementApiPath = apiPath;
            return output;
        }

        for (let svc of apiServices) {
            //get api handler
            let { handler, errMsg } = await this.getApiHandler(svc, apiPath, this.logger)

            if (!handler) {
                output.fail.push(svc.name);
                let logMsg = chalk.red(`Implement ${chalk.cyan.underline(`Api${svc.name}`)} failed:`);
                logMsg += '\n  |- ' + errMsg;
                this.logger.error(logMsg);
                continue;
            }

            this.implementApi(svc.name, handler);
            output.succ.push(svc.name);
        }

        if (output.fail.length) {
            this.logger.error(chalk.red(`${output.fail.length} API implemented failed: ` + output.fail.map(v => chalk.cyan.underline(v)).join(' ')))
        }

        return output;
    }

    async getApiHandler(svc: ApiServiceDef, apiPath?: string, logger?: Logger): Promise<{ handler: ApiHandler, errMsg?: undefined } | { handler?: undefined, errMsg: string }> {
        if (this._apiHandlers[svc.name]) {
            return { handler: this._apiHandlers[svc.name]! };
        }

        if (!apiPath) {
            return { errMsg: `Api not implemented: ${svc.name}` };
        }

        // get api last name
        let match = svc.name.match(/^(.+\/)*(.+)$/);
        if (!match) {
            logger?.error('Invalid apiName: ' + svc.name);
            return { errMsg: `Invalid api name: ${svc.name}` };
        }
        let handlerPath = match[1] || '';
        let handlerName = match[2];

        // try import
        let modulePath = path.resolve(apiPath, handlerPath, 'Api' + handlerName);
        try {
            let handlerModule = await import(modulePath);
            // 优先 default，其次 ApiName 同名
            let handler = handlerModule.default ?? handlerModule['Api' + handlerName];
            if (handler) {
                return { handler: handler };
            }
            else {
                return { errMsg: `Cannot find export { ${'Api' + handlerName} } at: ${modulePath}` }
            }
        }
        catch (e: any) {
            if (e.code === 'MODULE_NOT_FOUND') {
                return { errMsg: `Module not found: ${modulePath}` };
            }
            else {
                return { errMsg: e.message }
            }
        }
    }

    /**
     * Add a message handler,
     * duplicate handlers to the same `msgName` would be ignored.
     * @param msgName
     * @param handler
     */
    listenMsg<Msg extends keyof ServiceType['msg'], Call extends MsgCall<ServiceType['msg'][Msg]>>(msgName: Msg, handler: MsgHandler<Call>): MsgHandler<Call> {
        this._msgHandlers.addHandler(msgName as string, handler);
        return handler;
    };
    /**
     * Remove a message handler
     */
    unlistenMsg<Msg extends keyof ServiceType['msg'], Call extends MsgCall<ServiceType['msg'][Msg]>>(msgName: Msg, handler: Function): void {
        this._msgHandlers.removeHandler(msgName as string, handler);
    };
    /**
     * Remove all handlers from a message
     */
    unlistenMsgAll<Msg extends keyof ServiceType['msg'], Call extends MsgCall<ServiceType['msg'][Msg]>>(msgName: Msg): void {
        this._msgHandlers.removeAllHandlers(msgName as string);
    };
    // #endregion   

    /**
     * Event when the server cannot parse input buffer to api/msg call.
     * By default, it will return "Input Buffer Error" .
     */
    async onInputBufferError(errMsg: string, conn: BaseConnection<ServiceType>, buf: Uint8Array) {
        this.options.debugBuf && conn.logger.error(`[InputBufferError] ${errMsg} length = ${buf.length}`, buf.subarray(0, 16))

        // Short conn, send apiReturn with error
        if (conn.type === 'SHORT') {
            // Encode
            let serverOutputData: ServerOutputData = {
                error: {
                    message: 'Invalid input buffer, please check the version of service proto.',
                    /**
                     * @defaultValue ApiError
                     */
                    type: TsrpcErrorType.ServerError,
                    code: 'INPUT_BUF_ERR'
                }
            };
            let opEncode = TransportDataUtil.tsbuffer.encode(serverOutputData, 'ServerOutputData');
            if (opEncode.isSucc) {
                let opSend = await conn.sendBuf(opEncode.buf);
                if (opSend.isSucc) {
                    return;
                }
            }
        }

        conn.close('Input Buffer Error');
    }

    /**
     * Event when a uncaught error (except `TsrpcError`) is throwed.
     * By default, it will return a `TsrpcError` with message "Internal server error".
     * If `returnInnerError` is `true`, the original error would be returned as `innerErr` property.
     */
    onInternalServerError(err: { message: string, stack?: string, name?: string }, call: ApiCall) {
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
     * Stop the server gracefully.
     * Wait all API requests finished and then stop the server.
     * @param maxWaitTime - The max time(ms) to wait before force stop the server.
     * `undefined` and `0` means unlimited time.
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

    /**
     * Execute API function through the inner connection.
     * It is useful when you want to customize your transport method.
     * @param apiName 
     * @param req 
     * @param options 
     */
    callApi<T extends keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req']): Promise<ApiReturn<ServiceType['api'][T]['res']>> {
        return new Promise(rs => {
            // 确认是哪个Service
            let service = this.serviceMap.apiName2Service[apiName as string];
            if (!service) {
                let errMsg = `Cannot find service: ${apiName}`;
                this.logger.warn(`[callApi]`, errMsg);
                rs({ isSucc: false, err: new TsrpcError(errMsg, { type: TsrpcErrorType.ServerError, code: 'ERR_API_NAME' }) });
                return;
            }

            let conn = new InnerConnection({
                server: this,
                id: '' + this._connIdCounter.getNext(),
                ip: '',
                rs: rs
            });
            let call = new ApiCallInner({
                conn: conn,
                req: req,
                service: service
            });
            this._handleApiCall(call);
        })
    }
}

export interface BaseServerOptions<ServiceType extends BaseServiceType> {
    // TSBuffer相关
    /**
     * Whether to strictly distinguish between `null` and `undefined` when encoding, decoding, and type checking.
     * @defaultValue false
     */
    strictNullChecks: boolean,

    /**
     * Timeout for processing an `ApiCall`(ms)
     * `0` and `undefined` means unlimited time
     * @defaultValue 30000
     */
    apiTimeout: number | undefined,

    // LOG相关
    /**
     * Logger for processing log
     * @defaultValue `new TerminalColorLogger()` (print to console with color)
     */
    logger: Logger;
    /** 
     * Whethere to print API request body into log (may increase log size)
     * @defaultValue `true`
     */
    logReqBody: boolean;
    /** 
     * Whethere to print API response body into log (may increase log size)
     * @defaultValue `true`
     */
    logResBody: boolean;
    /**
     * Whethere to print `[SendMsg]` and `[RecvMsg]` log into log
     * @defaultValue `true`
     */
    logMsg: boolean;

    /**
     * If `true`, all sent and received raw buffer would be print into the log.
     * It may be useful when you do something for buffer encryption/decryption, and want to debug them.
     */
    debugBuf?: boolean;

    /**
     * When uncaught error throwed,
     * whether to return the original error as a property `innerErr`. 
     * (May include some sensitive information, suggests set to `false` in production environment.)
     * @defaultValue It depends on environment variable `NODE_ENV`.
     * If `NODE_ENV` equals to `production`, the default value is `false`, otherwise is `true`.
     */
    returnInnerError: boolean;
}

export const defaultBaseServerOptions: BaseServerOptions<any> = {
    strictNullChecks: false,
    apiTimeout: 30000,
    logger: new TerminalColorLogger,
    logReqBody: true,
    logResBody: true,
    logMsg: true,
    returnInnerError: process.env['NODE_ENV'] !== 'production'
}

export type ApiHandler<Call extends ApiCall = ApiCall> = (call: Call) => void | Promise<void>;
export type MsgHandler<Call extends MsgCall = MsgCall> = (call: Call) => void | Promise<void>;

export enum ServerStatus {
    Opening = 'OPENING',
    Opened = 'OPENED',
    Closing = 'CLOSING',
    Closed = 'CLOSED',
}