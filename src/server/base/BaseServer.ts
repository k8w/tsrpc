import 'colors';
import * as path from "path";
import { TSBuffer } from 'tsbuffer';
import { ApiServiceDef, BaseServiceType, Logger, ServiceProto, TsrpcError, TsrpcErrorType } from 'tsrpc-proto';
import { Flow } from '../../models/Flow';
import { MsgHandlerManager } from '../../models/MsgHandlerManager';
import { nodeUtf8 } from '../../models/nodeUtf8';
import { Pool } from '../../models/Pool';
import { ServiceMap, ServiceMapUtil } from '../../models/ServiceMapUtil';
import { ParsedServerInput, TransportDataUtil } from '../../models/TransportDataUtil';
import { PrefixLogger } from '../models/PrefixLogger';
import { TerminalColorLogger } from '../models/TerminalColorLogger';
import { ApiCall, ApiCallOptions, ApiReturn, BaseCall, MsgCall, MsgCallOptions } from './BaseCall';
import { BaseConnection } from './BaseConnection';

export abstract class BaseServer<
    ConnType extends BaseConnection,
    ApiCallType extends ApiCall,
    MsgCallType extends MsgCall,
    ServerOptions extends BaseServerOptions<ConnType>,
    ServiceType extends BaseServiceType
    > {

    /**
     * Start server
     */
    abstract start(): Promise<void>;

    /**
     * Wait all requests finished and the stop server
     * @param immediately Stop server immediately, not waiting for the requests ending
     */
    abstract stop(immediately?: boolean): Promise<void>;

    protected abstract _poolApiCall: Pool<ApiCall>;
    protected abstract _poolMsgCall: Pool<MsgCall>;

    // 配置及其衍生项
    readonly proto: ServiceProto<ServiceType>;
    readonly options: ServerOptions;
    readonly tsbuffer: TSBuffer;
    readonly serviceMap: ServiceMap;

    // Conn Flows
    readonly postConnectFlow = new Flow<ConnType>();
    readonly preDisconnectFlow = new Flow<ConnType>();
    readonly postDisconnectFlow = new Flow<ConnType>();

    // Buffer Flows
    readonly postRecvBufferFlow = new Flow<{ conn: ConnType, buf: Uint8Array }>();
    readonly preSendBufferFlow = new Flow<{ conn: ConnType, buf: Uint8Array, call?: ApiCallType | MsgCallType }>();
    readonly postSendBufferFlow = new Flow<{ conn: ConnType, buf: Uint8Array, call?: ApiCallType | MsgCallType }>();

    // ApiCall Flows
    readonly preApiCallFlow = new Flow<ApiCallType>();
    readonly preApiReturnFlow = new Flow<{ call: ApiCallType, return: ApiReturn<any> }>();
    readonly postApiReturnFlow = new Flow<{ call: ApiCallType, return: ApiReturn<any> }>();
    readonly postApiCallFlow = new Flow<ApiCallType>();

    // MsgCall Flows
    readonly preMsgCallFlow = new Flow<MsgCallType>();
    readonly postMsgCallFlow = new Flow<MsgCallType>();

    // Handlers
    private _apiHandlers: { [apiName: string]: ((call: ApiCall) => any) | undefined } = {};
    // 多个Handler将异步并行执行
    private _msgHandlers: MsgHandlerManager;

    readonly logger: Logger;

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

    constructor(proto: ServiceProto<ServiceType>, options: ServerOptions) {
        this.proto = proto;
        this.options = options;

        this.tsbuffer = new TSBuffer(proto.types, {
            strictNullChecks: this.options.strictNullChecks,
            utf8Coder: nodeUtf8
        });

        this.serviceMap = ServiceMapUtil.getServiceMap(proto);

        this.logger = options.logger;

        this._msgHandlers = new MsgHandlerManager(this.logger);
        PrefixLogger.pool.enabled = this.options.enablePool;

        // Process uncaught exception, so that Node.js process would not exit easily
        BaseServer.processUncaughtException(this.logger);
    }

    // #region receive buffer process flow
    protected async _onRecvBuffer(conn: ConnType, buf: Buffer) {
        // postRecvBufferFlow
        let opPostRecvBuffer = await this.postRecvBufferFlow.exec({ conn: conn, buf: buf });
        if (!opPostRecvBuffer) {
            return;
        }

        // Parse ServerInput
        let serverInput: ParsedServerInput;
        try {
            serverInput = this._parseBuffer(conn, buf);
        }
        catch (e) {
            this.options.onServerInputError(e, conn, buf);
            return;
        }

        // Parse RPC Call
        let call: BaseCall;
        try {
            call = this._makeCall(conn, input);
        }
        catch (e) {
            this.logger.error('Buffer cannot be resolved.', e);
            return;
        }

        // Handle Call
        if (call.type === 'api') {
            call.logger.log('[Req]', this.options.logReqBody ? call.req : '');
            let sn = call.sn;

            await new Promise<void>(rs => {
                // Timeout
                let timer: NodeJS.Timer | undefined;
                if (this.options.timeout) {
                    timer = setTimeout(() => {
                        if (call.type === 'api' && call.sn === sn && !call.sendedRes) {
                            call.error('Server Timeout', {
                                code: 'SERVER_TIMEOUT',
                                isServerError: true
                            });
                        }
                        rs();
                    }, this.options.timeout);
                }
                // Handle API
                this._handleApi(call as ApiCall).then(() => {
                    timer && clearTimeout(timer);
                    rs();
                });
            })

            // Api no response
            if (!call.sendedRes) {
                call.error('Api no response', {
                    code: 'API_NO_RES',
                    isServerError: true
                });
            }

            // 至此 应必定有 call.sendedRes
            if (call.sendedRes) {
                if (call.sendedRes.isSucc) {
                    call.logger.log('[Res]', `${call.usedTime}ms`, this.options.logResBody ? call.sendedRes.res : '');
                }
                else {
                    if (call.sendedRes.err.type === 'ApiError') {
                        call.logger.log('[ResError]', `${call.usedTime}ms`, call.sendedRes.err.message, call.sendedRes.err.info, 'req=', call.req);
                    }
                    else {
                        call.logger.error('[ResError]', `${call.usedTime}ms`, call.sendedRes.err, 'req=', call.req)
                    }
                }
            }
            else {
                call.logger.error('Invalid implement of ApiCall: no call.sendedRes');
            }

            this._afterApi(call);
        }
        else {
            call.logger.log('Msg=', call.msg);

            await new Promise<void>(rs => {
                // Timeout
                if (this.options.timeout) {
                    setTimeout(() => {
                        rs();
                    }, this.options.timeout);
                }
                // Handle API
                this._handleMsg(call as MsgCall).then(() => {
                    rs();
                });
            })

            this._afterMsg(call);
        }
    }

    protected _parseBuffer(conn: ConnType, buf: Uint8Array): ParsedServerInput {
        return TransportDataUtil.parseServerInput(this.tsbuffer, this.serviceMap, buf);
    }

    protected _makeCall(conn: ConnType, input: ParsedServerInput): BaseCall {
        if (input.type === 'api') {
            return this._poolApiCall.get({
                conn: conn,
                sn: input.sn,
                logger: PrefixLogger.pool.get({
                    logger: conn.logger,
                    prefixs: [`API#${input.sn} [${input.service.name}]`]
                }),
                service: input.service,
                req: input.req,
                startTime: Date.now()
            })
        }
        else {
            return this._poolMsgCall.get({
                conn: conn,
                logger: PrefixLogger.pool.get({
                    logger: conn.logger,
                    prefixs: [`MSG [${input.service.name}]`]
                }),
                service: input.service,
                msg: input.msg
            })
        }
    }

    private async _execFlow(flow: ((...args: any[]) => boolean | Promise<boolean>)[], ...params: any[]): Promise<{ continue: boolean, err?: Error }> {
        for (let i = 0; i < flow.length; ++i) {
            try {
                let res = flow[i](...params);
                if (res instanceof Promise) {
                    res = await res;
                }

                // Return 非true 表示不继续后续流程 立即中止
                if (!res) {
                    return { continue: false };
                }
            }
            // 一旦有异常抛出 立即中止处理流程
            catch (e) {
                return { continue: false, err: e };
            }
        }
        return { continue: true };
    }

    protected async _handleApi(call: ApiCall) {
        let op = await this._execFlow(this.apiFlow, call);
        // 打印错误信息
        if (op.err) {
            call.logger.error('[API_FLOW_ERR]', op.err);
        }
        // 已经返回过，强制中断
        if (call.sendedRes) {
            return;
        }
        // Flow内部表示不需要再继续
        if (!op.continue) {
            // TsrpcError 抛给前台
            if (op.err && op.err instanceof TsrpcError) {
                call.error(op.err.message, op.err.info);
            }
            // 服务器内部错误
            else {
                call.logger.error('[API_FLOW_ERR]', op.err);
                this.options.onInternalServerError(op.err || new Error('Internal server error'), call);
            }
            return;
        }

        let handler = this._apiHandlers[call.service.name];
        if (handler) {
            try {
                let res = handler(call);
                if (res instanceof Promise) {
                    await res;
                }
            }
            catch (e) {
                if (e instanceof TsrpcError) {
                    call.error(e.message, e.info);
                }
                else {
                    call.logger.error(e);
                    this.options.onInternalServerError(e, call);
                }
            }
        }
        // 未找到ApiHandler，且未进行任何输出
        else {
            call.error(`Unhandled API: ${call.service.name}`, { code: 'UNHANDLED_API' })
        }
    }

    protected async _handleMsg(call: MsgCall) {
        let op = await this._execFlow(this.msgFlow, call);
        if (!op.continue) {
            if (op.err) {
                call.logger.error('[MSG_FLOW_ERR]', op.err);
            }
            return;
        }

        // MsgHandler
        let promises = this._msgHandlers.forEachHandler(call.service.name, call);
        if (!promises.length) {
            this.logger.debug('[UNHANDLED_MSG]', call.service.name);
        }
        else {
            await Promise.all(promises);
        }
    }

    protected _afterApi(call: ApiCall) {
        call.destroy();
    }
    protected _afterMsg(call: MsgCall) {
        call.destroy();
    };
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

    autoImplementApi(apiPath: string, apiNamePrefix?: string): { succ: string[], fail: string[] } {
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
                let handlerModule = require(modulePath);
                // ApiName同名
                apiHandler = handlerModule['Api' + handlerName];
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

}

export const defualtBaseServerOptions: BaseServerOptions = {
    strictNullChecks: true,
    logger: new TerminalColorLogger,
    logReqBody: true,
    logResBody: true,
    enablePool: false,
    onRecvBufferError: (e, conn, buf) => {
        conn.logger.error(`[${conn.ip}] [Invalid Input Buffer] length=${buf.length}`, buf.subarray(0, 16))
        conn.close('INVALID_INPUT_BUFFER');
    },
    onApiC: (err, call) => {
        call.error('Internal server error', {
            code: 'INTERNAL_ERR',
            type: TsrpcErrorType.ServerError,
            innerError: call.conn.server.options.returnInnerError ? {
                message: err.message,
                stack: err.stack
            } : undefined
        });
    },
    returnInnerError: process.env['NODE_ENV'] !== 'production'

}

/** @public */
export interface BaseServerOptions<ConnType extends BaseConnection> {
    // TSBuffer相关
    /**
     * `undefined` 和 `null` 是否可以混合编码
     * 默认: `true`
     */
    strictNullChecks: boolean,

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
     * 处理API的最大执行时间，超过此时间call将被释放并返回超时错误
     * 为 `undefined` 则不限制处理时间
     */
    apiTimeout?: number | undefined;

    /**
     * When the server cannot parse input buffer to api/msg call
     * By default, it will return "INVALID_INPUT_BUFFER" .
     */
    onRecvBufferError: (e: Error | TsrpcError, conn: ConnType, buf: Uint8Array) => void;
    /**
     * On error throwed inside (not TsrpcError)
     * By default, it will return a "Internal server error".
     * If `returnInnerError` is `true`, an `innerError` field would be returned.
     */
    onApiCallInternalError: (e: Error | TsrpcError, call: ApiCall) => void;
    /**
     * When "Internal server error" occured,
     * whether to return `innerError` to client. 
     * It depends on `NODE_ENV` by default. (be `false` when `NODE_ENV` is `production`, otherwise be `true`)
     */
    returnInnerError: boolean;

    /** 是否对Conn和Call启用Pool，开启将极大优化内存
     * 但要自己额外确保每个Api/Msg Handler返回后，不会再引用到call
     * @defaultValue false
     */
    enablePool: boolean;
}

export type ApiHandler<Req = any, Res = any> = (call: ApiCall<Req, Res, ApiCallOptions>) => void | Promise<void>;
export type MsgHandler<Msg = any> = (msg: MsgCall<Msg, MsgCallOptions>) => void | Promise<void>;