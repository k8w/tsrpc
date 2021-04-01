import 'colors';
import * as path from "path";
import { TSBuffer } from 'tsbuffer';
import { ApiServiceDef, BaseServiceType, Logger, ServiceProto, TsrpcError, TsrpcErrorType } from 'tsrpc-proto';
import { ApiReturn } from '../../models/ApiReturn';
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
    abstract stop(immediately?: boolean): Promise<void>;

    // 配置及其衍生项
    readonly proto: ServiceProto<ServiceType>;
    readonly options: BaseServerOptions = {
        ...defaultBaseServerOptions
    };
    readonly tsbuffer: TSBuffer;
    readonly serviceMap: ServiceMap;
    readonly logger: Logger;

    /** Flows */
    readonly flows = {
        // Conn Flows
        postConnectFlow: new Flow<BaseConnection>(),
        preDisconnectFlow: new Flow<BaseConnection>(),
        postDisconnectFlow: new Flow<BaseConnection>(),

        // Buffer Flows
        postRecvBufferFlow: new Flow<{ conn: BaseConnection, buf: Uint8Array }>(),
        preSendBufferFlow: new Flow<{ conn: BaseConnection, buf: Uint8Array, call?: ApiCall }>(),
        /** 不会中断后续流程 */
        postSendBufferFlow: new Flow<{ conn: BaseConnection, buf: Uint8Array, call?: ApiCall }>(),

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
        preSendMsgFlow: new Flow<{ service: MsgService, msg: any }>(),
        postSendMsgFlow: new Flow<{ service: MsgService, msg: any }>(),
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

    constructor(proto: ServiceProto<ServiceType>, options?: Partial<BaseServerOptions>) {
        this.proto = proto;
        Object.assign(this.options, options);

        this.tsbuffer = new TSBuffer(proto.types, {
            strictNullChecks: this.options.strictNullChecks,
            utf8Coder: nodeUtf8
        });
        this.serviceMap = ServiceMapUtil.getServiceMap(proto);
        this.logger = this.options.logger;

        // Process uncaught exception, so that Node.js process would not exit easily
        BaseServer.processUncaughtException(this.logger);
    }

    // #region receive buffer process flow
    protected async _onRecvBuffer(conn: BaseConnection, buf: Buffer) {
        // postRecvBufferFlow
        let opPostRecvBuffer = await this.flows.postRecvBufferFlow.exec({ conn: conn, buf: buf });
        if (!opPostRecvBuffer) {
            return;
        }

        // Parse Call
        let opInput = TransportDataUtil.parseServerInput(this.tsbuffer, this.serviceMap, buf);
        if (!opInput.isSucc) {
            this.options.onParseCallError(opInput.errMsg, conn, buf);
            return;
        }
        let call = this._makeCall(conn, opInput.result);

        if (call.type === 'api') {
            this._onApiCall(call);
        }
        else {
            this._onMsgCall(call);
        }
    }

    protected _makeCall(conn: BaseConnection, input: ParsedServerInput): ApiCall | MsgCall {
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
        // Pre Flow
        let preFlow = await this.flows.preApiCallFlow.exec(call);
        if (!preFlow) {
            return;
        }
        call = preFlow;

        // exec ApiCall
        call.logger.log('[Req]', this.options.logReqBody ? call.req : '');
        let handler = this._apiHandlers[call.service.name];
        // 未找到ApiHandler，且未进行任何输出
        if (!handler) {
            call.error(`Unhandled API: ${call.service.name}`, { code: 'UNHANDLED_API', type: TsrpcErrorType.ServerError })
            return;
        }
        // exec
        try {
            await handler(call);
        }
        catch (e) {
            if (e instanceof TsrpcError) {
                call.error(e);
            }
            else {
                this.options.onApiInnerError(e, call);
            }
        }

        // Post Flow
        await this.flows.postApiCallFlow.exec(call);

        // Destroy call
        if (!call.return) {
            await call.error('Api no response', {
                code: 'API_NO_RES',
                type: TsrpcErrorType.ServerError
            });
        }
        call.destroy();
    }

    protected async _onMsgCall(call: MsgCall) {
        // Pre Flow
        let preFlow = await this.flows.preMsgCallFlow.exec(call);
        if (!preFlow) {
            return;
        }
        call = preFlow;

        // MsgHandler
        call.logger.log('[Msg]', call.msg);
        let promises = this._msgHandlers.forEachHandler(call.service.name, call.logger);
        if (!promises.length) {
            this.logger.debug('[UNHANDLED_MSG]', call.service.name);
        }
        else {
            await Promise.all(promises);
        }

        // Post Flow
        await this.flows.postMsgCallFlow.exec(call);
        call.destroy();
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

}

/** @public */
export interface BaseServerOptions {
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
     * When the server cannot parse input buffer to api/msg call
     * By default, it will return "INVALID_INPUT_BUFFER" .
     */
    onParseCallError: (errMsg: string, conn: BaseConnection, buf: Uint8Array) => void;
    /**
     * On error throwed inside (not TsrpcError)
     * By default, it will return a "Internal server error".
     * If `returnInnerError` is `true`, an `innerError` field would be returned.
     */
    onApiInnerError: (e: Error, call: ApiCall) => void;
    /**
     * When "Internal server error" occured,
     * whether to return `innerError` to client. 
     * It depends on `NODE_ENV` by default. (be `false` when `NODE_ENV` is `production`, otherwise be `true`)
     */
    returnInnerError: boolean;
}

export const defaultBaseServerOptions: BaseServerOptions = {
    strictNullChecks: true,
    logger: new TerminalColorLogger,
    logReqBody: true,
    logResBody: true,
    onParseCallError: (e, conn, buf) => {
        conn.logger.error(`[${conn.ip}] [Invalid input buffer] length=${buf.length}`, buf.subarray(0, 16))
        conn.close('INVALID_INPUT_BUFFER');
    },
    onApiInnerError: (err, call) => {
        call.error('Internal Server Error', {
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

export type ApiHandler<Req = any, Res = any> = (call: ApiCall<Req, Res>) => void | Promise<void>;
export type MsgHandler<Msg = any> = (msg: MsgCall<Msg>) => void | Promise<void>;
