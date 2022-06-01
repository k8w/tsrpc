import { ObjectId } from "bson";
import chalk from "chalk";
import * as path from "path";
import { TSBuffer } from 'tsbuffer';
import { ApiService, Counter, Flow, getCustomObjectIdTypes, MsgHandlerManager, MsgService, ParsedServerInput, ServiceMap, ServiceMapUtil, TransportDataUtil } from 'tsrpc-base-client';
import { ApiReturn, ApiServiceDef, BaseServiceType, Logger, LogLevel, ServerInputData, ServiceProto, setLogLevel, TsrpcError, TsrpcErrorType } from 'tsrpc-proto';
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
         * Before processing the received data, usually be used to encryption / decryption.
         * Return `null | undefined` would ignore the buffer.
         */
        preRecvDataFlow: new Flow<{ conn: BaseConnection<ServiceType>, data: string | Uint8Array | object, serviceName?: string }>(),
        /**
         * Before send out data to network, usually be used to encryption / decryption.
         * Return `null | undefined` would not send the buffer.
         */
        preSendDataFlow: new Flow<{ conn: BaseConnection<ServiceType>, data: string | Uint8Array | object, call?: ApiCall }>(),
        /**
         * @deprecated Use `preRecvDataFlow` instead.
         */
        preRecvBufferFlow: new Flow<{ conn: BaseConnection<ServiceType>, buf: Uint8Array }>(),
        /**
         * @deprecated Use `preSendDataFlow` instead.
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

        // @deprecated jsonEnabled
        if (this.options.json) {
            this.options.jsonEnabled = true;
        }

        this.tsbuffer = new TSBuffer({
            ...proto.types,
            // Support mongodb/ObjectId
            ...getCustomObjectIdTypes(ObjectId)
        }, {
            strictNullChecks: this.options.strictNullChecks
        });
        this.serviceMap = ServiceMapUtil.getServiceMap(proto);
        this.logger = this.options.logger;
        setLogLevel(this.logger, this.options.logLevel);

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
    async _onRecvData(conn: BaseConnection<ServiceType>, data: string | Uint8Array | object, serviceName?: string) {
        // 非 OPENED 状态 停止接受新的请求
        if (!(conn instanceof InnerConnection) && this.status !== ServerStatus.Opened) {
            return;
        }

        // debugBuf log
        if (this.options.debugBuf) {
            if (typeof data === 'string') {
                conn.logger?.debug(`[RecvText] length=${data.length}`, data);
            }
            else if (data instanceof Uint8Array) {
                conn.logger?.debug(`[RecvBuf] length=${data.length}`, data);
            }
            else {
                conn.logger?.debug('[RecvJSON]', data);
            }
        }

        // jsonEnabled 未启用，不支持文本请求
        if (typeof data === 'string' && !this.options.jsonEnabled) {
            this.onInputDataError('JSON mode is not enabled, please use binary instead.', conn, data);
            return;
        }

        let pre = await this.flows.preRecvDataFlow.exec({ conn: conn, data: data, serviceName: serviceName }, conn.logger);
        if (!pre) {
            conn.logger.debug('[preRecvDataFlow] Canceled');
            return;
        }
        data = pre.data;
        serviceName = pre.serviceName;

        // @deprecated preRecvBuffer
        if (data instanceof Uint8Array) {
            let preBuf = await this.flows.preRecvBufferFlow.exec({ conn: conn, buf: data }, conn.logger);
            if (!preBuf) {
                conn.logger.debug('[preRecvBufferFlow] Canceled');
                return;
            }
            data = preBuf.buf;
        }

        // Parse Call
        let opInput = this._parseServerInput(this.tsbuffer, this.serviceMap, data, serviceName);
        if (!opInput.isSucc) {
            this.onInputDataError(opInput.errMsg, conn, data);
            return;
        }
        let call = conn.makeCall(opInput.result);

        if (call.type === 'api') {
            await this._handleApiCall(call);
        }
        else {
            await this._onMsgCall(call);
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
            call.logger.debug('[preApiCallFlow] Canceled');
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
            call.logger.debug('[preMsgCallFlow]', 'Canceled')
            return;
        }
        call = preFlow;

        // MsgHandler
        this.options.logMsg && call.logger.log('[RecvMsg]', call.msg);
        let promises = [
            // Conn Handlers
            ...(call.conn['_msgHandlers']?.forEachHandler(call.service.name, call.logger, call) ?? []),
            // Server Handlers
            this._msgHandlers.forEachHandler(call.service.name, call.logger, call)
        ];
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
    implementApi<Api extends string & keyof ServiceType['api'], Call extends ApiCall<ServiceType['api'][Api]['req'], ServiceType['api'][Api]['res']>>(apiName: Api, handler: ApiHandler<Call>): void {
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
            let { handler } = await this.getApiHandler(svc, apiPath, this.logger)

            if (!handler) {
                output.fail.push(svc.name);
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
            var handlerModule = await import(modulePath);
        }
        catch (e: unknown) {
            this.logger.error(chalk.red(`Implement API ${chalk.cyan.underline(`${svc.name}`)} failed:`), e);
            return { errMsg: (e as Error).message };
        }

        // 优先 default，其次 ApiName 同名
        let handler = handlerModule.default ?? handlerModule['Api' + handlerName];
        if (handler) {
            return { handler: handler };
        }
        else {
            return { errMsg: `Missing 'export Api${handlerName}' or 'export default' in: ${modulePath}` }
        }
    }

    /**
     * Add a message handler,
     * duplicate handlers to the same `msgName` would be ignored.
     * @param msgName
     * @param handler
     */
    listenMsg<Msg extends string & keyof ServiceType['msg'], Call extends MsgCall<ServiceType['msg'][Msg]>>(msgName: Msg, handler: MsgHandler<Call>): MsgHandler<Call> {
        this._msgHandlers.addHandler(msgName as string, handler);
        return handler;
    };
    /**
     * Remove a message handler
     */
    unlistenMsg<Msg extends string & keyof ServiceType['msg'], Call extends MsgCall<ServiceType['msg'][Msg]>>(msgName: Msg, handler: Function): void {
        this._msgHandlers.removeHandler(msgName as string, handler);
    };
    /**
     * Remove all handlers from a message
     */
    unlistenMsgAll<Msg extends string & keyof ServiceType['msg'], Call extends MsgCall<ServiceType['msg'][Msg]>>(msgName: Msg): void {
        this._msgHandlers.removeAllHandlers(msgName as string);
    };
    // #endregion   

    /**
     * Event when the server cannot parse input buffer to api/msg call.
     * By default, it will return "Input Data Error" .
     */
    async onInputDataError(errMsg: string, conn: BaseConnection<ServiceType>, data: string | Uint8Array | object) {
        if (this.options.debugBuf) {
            if (typeof data === 'string') {
                conn.logger.error(`[InputDataError] ${errMsg} length = ${data.length}`, data)
            }
            else if (data instanceof Uint8Array) {
                conn.logger.error(`[InputBufferError] ${errMsg} length = ${data.length}`, data.subarray(0, 16))
            }
            else {
                conn.logger.error(`[InputJsonError] ${errMsg} `, data)
            }
        }

        const message = data instanceof Uint8Array ? `Invalid request buffer, please check the version of service proto.` : errMsg;

        // Short conn, send apiReturn with error
        if (conn.type === 'SHORT') {
            // Return API Error
            let opEncode = ApiCall.encodeApiReturn(this.tsbuffer, {
                type: 'api',
                name: '?',
                id: 0,
                reqSchemaId: '?',
                resSchemaId: '?'
            }, {
                isSucc: false,
                err: new TsrpcError({
                    message: message,
                    type: TsrpcErrorType.ServerError,
                    code: 'INPUT_DATA_ERR'
                })
            }, conn.dataType)
            if (opEncode.isSucc) {
                let opSend = await conn.sendData(opEncode.output);
                if (opSend.isSucc) {
                    return;
                }
            }
        }

        conn.close(message);
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
     * Execute API function through the inner connection, which is useful for unit test.
     * 
     * **NOTICE**
     * The `req` and return value is native JavaScript object which is not compatible to JSON. (etc. ArrayBuffer, Date, ObjectId)
     * If you are using pure JSON as transfering, you may need use `callApiByJSON`.
     * @param apiName 
     * @param req 
     * @param options 
     */
    callApi<T extends string & keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req']): Promise<ApiReturn<ServiceType['api'][T]['res']>> {
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
                dataType: 'json',
                server: this,
                id: '' + this._connIdCounter.getNext(),
                ip: '',
                return: {
                    type: 'raw',
                    rs: rs
                }
            });
            let call = new ApiCallInner({
                conn: conn,
                req: req,
                service: service
            });
            this._handleApiCall(call);
        })
    }

    /**
     * Like `server.callApi`, but both input and output are pure JSON object,
     * which can be `JSON.stringify()` and `JSON.parse()` directly.
     * Types that not compatible to JSON, would be encoded and decoded automatically.
     * @param apiName - The same with `server.callApi`, may be parsed from the URL.
     * @param jsonReq - Request data in pure JSON
     * @returns Encoded `ApiReturn<Res>` in pure JSON
     */

    /**
     * Process JSON request by inner proxy, this is useful when you are porting to cloud function services.
     * Both the input and output is pure JSON, ArrayBuffer/Date/ObjectId are encoded to string automatically.
     * @param apiName - Parsed from URL
     * @param req - Pure JSON
     * @returns - Pure JSON
     */
    async inputJSON(apiName: string, req: object): Promise<ApiReturn<object>> {
        if (apiName.startsWith('/')) {
            apiName = apiName.slice(1);
        }
        if (!this.serviceMap.apiName2Service[apiName]) {
            return {
                isSucc: false,
                err: new TsrpcError(`Invalid service name: ${apiName}`, {
                    type: TsrpcErrorType.ServerError,
                    code: 'INPUT_DATA_ERR'
                })
            };
        }

        return new Promise(rs => {
            let conn = new InnerConnection({
                dataType: 'json',
                server: this,
                id: '' + this._connIdCounter.getNext(),
                ip: '',
                return: {
                    type: 'json',
                    rs: rs
                }
            });

            this._onRecvData(conn, req, apiName);
        })
    }

    /**
     * Process input buffer by inner proxy, this is useful when you are porting to cloud function services.
     * @param buf Input buffer (may be sent by TSRPC client)
     * @returns Response buffer
     */
    inputBuffer(buf: Uint8Array): Promise<Uint8Array> {
        return new Promise(rs => {
            let conn = new InnerConnection({
                dataType: 'buffer',
                server: this,
                id: '' + this._connIdCounter.getNext(),
                ip: '',
                return: {
                    type: 'buffer',
                    rs: rs
                }
            });

            this._onRecvData(conn, buf);
        })
    }

    protected _parseServerInput(tsbuffer: TSBuffer, serviceMap: ServiceMap, data: string | Uint8Array | object, serviceName?: string): { isSucc: true, result: ParsedServerInput } | { isSucc: false, errMsg: string } {
        if (data instanceof Uint8Array) {
            let opServerInputData = TransportDataUtil.tsbuffer.decode(data, 'ServerInputData');

            if (!opServerInputData.isSucc) {
                return opServerInputData;
            }
            let serverInput = opServerInputData.value as ServerInputData;

            // 确认是哪个Service
            let service = serviceMap.id2Service[serverInput.serviceId];
            if (!service) {
                return { isSucc: false, errMsg: `Cannot find service ID: ${serverInput.serviceId}` }
            }

            // 解码Body
            if (service.type === 'api') {
                let opReq = tsbuffer.decode(serverInput.buffer, service.reqSchemaId);
                return opReq.isSucc ? {
                    isSucc: true,
                    result: {
                        type: 'api',
                        service: service,
                        req: opReq.value,
                        sn: serverInput.sn
                    }
                } : opReq
            }
            else {
                let opMsg = tsbuffer.decode(serverInput.buffer, service.msgSchemaId);
                return opMsg.isSucc ? {
                    isSucc: true,
                    result: {
                        type: 'msg',
                        service: service,
                        msg: opMsg.value
                    }
                } : opMsg;
            }
        }
        else {
            let json: object;
            if (typeof data === 'string') {
                try {
                    json = JSON.parse(data);
                }
                catch (e: any) {
                    return { isSucc: false, errMsg: `Input is not a valid JSON string: ${e.message}` };
                }
            }
            else {
                json = data;
            }

            let body: any;
            let sn: number | undefined;

            // Parse serviceName / body / sn
            let service: ApiService | MsgService | undefined;
            const oriServiceName = serviceName;
            if (serviceName == undefined) {
                if (!Array.isArray(json)) {
                    return { isSucc: false, errMsg: `Invalid request format: unresolved service name.` };
                }
                serviceName = json[0] as string;
                body = json[1];
                sn = json[2];
            }
            else {
                body = json;
            }

            // Get Service
            service = serviceMap.apiName2Service[serviceName] ?? serviceMap.msgName2Service[serviceName];
            if (!service) {
                let errMsg = `Invalid service name: ${chalk.cyan.underline(serviceName)}`;

                // 可能是 JSON 模式下，jsonHostPath 未设置妥当的原因，此时给予友好提示
                if (oriServiceName) {
                    // TODO
                }

                return { isSucc: false, errMsg: errMsg };
            }

            // Decode
            if (service.type === 'api') {
                let op = tsbuffer.decodeJSON(body, service.reqSchemaId);
                if (!op.isSucc) {
                    return op;
                }
                return {
                    isSucc: true,
                    result: {
                        type: 'api',
                        service: service,
                        sn: sn,
                        req: op.value
                    }
                };
            }
            else {
                let op = tsbuffer.decodeJSON(body, service.msgSchemaId);
                if (!op.isSucc) {
                    return op;
                }
                return {
                    isSucc: true,
                    result: {
                        type: 'msg',
                        service: service,
                        msg: op.value
                    }
                }
            }
        }
    }
}

export interface BaseServerOptions<ServiceType extends BaseServiceType> {
    /**
     * Whether to enable JSON compatible mode.
     * When it is true, it can be compatible with typical HTTP JSON request (like RESTful API).
     * 
     * @remarks
     * The JSON request methods are:
     * 
     * 1. Add `Content-type: application/json` to request header.
     * 2. HTTP request is: `POST /{jsonUrlPath}/{apiName}`.
     * 3. POST body is JSON string.
     * 4. The response body is JSON string also.
     * 
     * NOTICE: Buffer type are not supported due to JSON not support them.
     * For security and efficient reason, we strongly recommend you use binary encoded transportation.
     * 
     * @defaultValue `false`
     */
    json: boolean,
    /** @deprecated Use `json` instead. */
    jsonEnabled?: boolean,

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
     * The minimum log level of `logger`
     * @defaultValue `debug`
     */
    logLevel: LogLevel;
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
    json: false,
    strictNullChecks: false,
    apiTimeout: 30000,
    logger: new TerminalColorLogger,
    logLevel: 'debug',
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