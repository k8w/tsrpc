import { ApiCall, MsgCall, BaseCall, ApiCallOptions, MsgCallOptions } from './BaseCall';
import { Logger, PrefixLogger } from './Logger';
import { HandlerManager } from '../models/HandlerManager';
import { TSBuffer } from 'tsbuffer';
import * as path from "path";
import { BaseServiceType, ServiceProto, ApiServiceDef, TsrpcError } from 'tsrpc-proto';
import { ServiceMapUtil, ServiceMap } from '../models/ServiceMapUtil';
import { Pool } from '../models/Pool';
import { ParsedServerInput, TransportDataUtil } from '../models/TransportDataUtil';
import 'colors';
import { nodeUtf8 } from '../models/nodeUtf8';
import { TSBufferOptions } from 'tsbuffer/src/TSBuffer';

export type ConnectionCloseReason = 'INVALID_INPUT_BUFFER' | 'DATA_FLOW_BREAK' | 'NO_RES';
export type BaseConnection = {
    isClosed: boolean;
    close: (reason?: ConnectionCloseReason) => void,
    ip: string,
    logger: Logger
}

export abstract class BaseServer<ServerOptions extends BaseServerOptions, ServiceType extends BaseServiceType = any> {

    abstract start(): Promise<void>;
    abstract stop(immediately?: boolean): Promise<void>;
    // protected abstract _makeCall(conn: any, input: ParsedServerInput): BaseCall;
    protected abstract _poolApiCall: Pool<ApiCall>;
    protected abstract _poolMsgCall: Pool<MsgCall>;

    // 配置及其衍生项
    readonly options: ServerOptions;
    readonly tsbuffer: TSBuffer;
    readonly serviceMap: ServiceMap;

    // Flows
    protected _dataFlow: ((data: Buffer, conn: BaseConnection) => (boolean | Promise<boolean>))[] = [];
    readonly apiFlow: (<T extends keyof ServiceType['req']>(call: ApiCall<ServiceType['req'][T], ServiceType['res'][T]>) => (boolean | Promise<boolean>))[] = [];
    readonly msgFlow: (<T extends keyof ServiceType['msg']>(call: MsgCall<ServiceType['msg'][T]>) => (boolean | Promise<boolean>))[] = [];

    // Handlers
    private _apiHandlers: { [apiName: string]: ((call: ApiCall) => any) | undefined } = {};
    // 多个Handler将异步并行执行
    private _msgHandlers: HandlerManager;

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

    constructor(options: ServerOptions) {
        this.options = options;
        this.tsbuffer = new TSBuffer(this.options.proto.types, {
            utf8: nodeUtf8,
            ...this.options.tsbufferOptions
        });
        this.serviceMap = ServiceMapUtil.getServiceMap(this.options.proto);
        this.logger = options.logger;
        this._msgHandlers = new HandlerManager(this.logger);
        PrefixLogger.pool.enabled = this.options.enablePool;

        BaseServer.processUncaughtException(this.logger);
    }

    // #region Data process flow
    async onData(conn: BaseConnection, data: Buffer) {
        // DataFlow
        let op = await this._execFlow(this._dataFlow, data, conn);
        // 错误输出到日志
        if (op.err) {
            conn.logger.error('[DATA_FLOW_ERR]', op.err);
        }
        // Data内部表示不需要再继续
        if (!op.continue) {
            return;
        }

        // Decrypt
        this.options.debugBuf && conn.logger.debug('[RecvBuf]', data);
        let buf: Uint8Array;
        if (this.options.decrypter) {
            buf = this.options.decrypter(data);
            this.options.debugBuf && conn.logger.debug('[DecryptedBuf]', data);
        }
        else {
            buf = data;
        }

        // Parse Server Input
        let input: ParsedServerInput;
        try {
            input = this._parseBuffer(conn, buf);
        }
        catch (e) {
            if (this.options.onServerInputError) {
                this.options.onServerInputError(e, conn);
            }
            else {
                this.logger.error(`[${conn.ip}] [Invalid Input Buffer] length=${buf.length}`, buf.subarray(0, 16))
                conn.close('INVALID_INPUT_BUFFER');
            }
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
                        if (call.type === 'api' && call.sn === sn && !call.res) {
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
            if (!call.res) {
                call.error('Api no response', {
                    code: 'API_NO_RES',
                    isServerError: true
                });
            }

            // 至此 应必定有 call.res
            if (call.res) {
                if (call.res.isSucc) {
                    call.logger.log('[Res]', `${call.res.usedTime}ms`, this.options.logResBody ? call.res.data : '');
                }
                else {
                    if (call.res.error.type === 'ApiError') {
                        call.logger.log('[ResError]', `${call.res.usedTime}ms`, call.res.error.message, call.res.error.info, 'req=', call.req);
                    }
                    else {
                        call.logger.error('[ResError]', `${call.res.usedTime}ms`, call.res.error, 'req=', call.req)
                    }
                }
            }
            else {
                call.logger.error('Invalid implement of ApiCall: no call.res');
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

    protected _parseBuffer(conn: BaseConnection, buf: Uint8Array): ParsedServerInput {
        return TransportDataUtil.parseServerInput(this.tsbuffer, this.serviceMap, buf);
    }

    protected _makeCall(conn: BaseConnection, input: ParsedServerInput): BaseCall {
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
        if (call.res) {
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
            call.error(`Unhandled API: ${call.service.name}`, 'UNHANDLED_API')
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
    implementApi<T extends keyof ServiceType['req']>(apiName: T, handler: ApiHandler<ServiceType['req'][T], ServiceType['res'][T]>): void {
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

let pid = process.pid.toString(16);
export const consoleColorLogger: Logger = {
    debug(...args: any[]) {
        console.debug.call(console, `<${pid}> ${new Date().format()}`.gray, '[DEBUG]'.cyan, ...args);
    },
    log(...args: any[]) {
        console.log.call(console, `<${pid}> ${new Date().format()}`.gray, '[INFO]'.green, ...args);
    },
    warn(...args: any[]) {
        console.warn.call(console, `<${pid}> ${new Date().format()}`.gray, '[WARN]'.yellow, ...args);
    },
    error(...args: any[]) {
        console.error.call(console, `<${pid}> ${new Date().format()}`.gray, '[ERROR]'.red, ...args);
    },
}

export const defualtBaseServerOptions: BaseServerOptions = {
    proto: { services: [], types: {} },
    logger: consoleColorLogger,
    logReqBody: true,
    logResBody: true,
    enablePool: false,
    onInternalServerError: (err, call) => {
        call.error('Internal server error', {
            code: 'INTERNAL_ERR',
            isServerError: true
        });
    }
}

export interface BaseServerOptions<ServiceType extends BaseServiceType = any> {
    proto: ServiceProto<ServiceType>;
    tsbufferOptions?: Partial<TSBufferOptions>;

    // LOG相关
    logger: Logger;
    logReqBody: boolean;
    logResBody: boolean;

    encrypter?: (src: Uint8Array) => Uint8Array;
    decrypter?: (cipher: Uint8Array) => Uint8Array;
    /** 为true时将在控制台debug打印buffer信息 */
    debugBuf?: boolean;

    /** 处理API和MSG的最大执行时间，超过此时间call将被释放 */
    timeout?: number;

    // 是否在message后加入ErrorSN
    showErrorSn?: boolean;

    onServerInputError?: (e: Error, conn: BaseConnection) => void;
    onInternalServerError: (e: Error, call: ApiCall) => void

    /** 是否对Conn和Call启用Pool，开启将极大优化内存
     * 但要自己额外确保每个Api/Msg Handler返回后，不会再引用到call
     */
    enablePool: boolean;
}

export type ApiHandler<Req = any, Res = any> = (call: ApiCall<Req, Res, ApiCallOptions>) => void | Promise<void>;
export type MsgHandler<Msg = any> = (msg: MsgCall<Msg, MsgCallOptions>) => void | Promise<void>;