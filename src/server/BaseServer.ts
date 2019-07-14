import { ApiCall, MsgCall, BaseCall } from './BaseCall';
import { ServiceProto, ServiceDef, ApiServiceDef, MsgServiceDef } from '../proto/ServiceProto';
import { Logger, PrefixLogger } from './Logger';
import { HandlerManager } from '../models/HandlerManager';
import { TsrpcError } from '../models/TsrpcError';
import { TSBuffer } from 'tsbuffer';
import * as path from "path";

export interface BaseServiceType {
    req: any,
    res: any,
    msg: any
}

export abstract class BaseServer<ServerOptions extends BaseServerOptions, ServiceType extends BaseServiceType = any> {
    abstract start(): Promise<void>;
    abstract stop(immediately?: boolean): Promise<void>;
    protected abstract _makeCall(conn: any, buf: Uint8Array): BaseCall;

    // 配置及其衍生项
    protected _options: ServerOptions;
    readonly tsbuffer: TSBuffer;
    readonly serviceMap: ServiceMap;

    // Flows
    readonly apiFlow: (<T extends string>(call: ApiCall<ServiceType['req'][T], ServiceType['res'][T]>) => (boolean | Promise<boolean>))[] = [];
    readonly msgFlow: (<T extends string>(call: MsgCall<ServiceType['msg'][T]>) => (boolean | Promise<boolean>))[] = [];

    // Handlers
    private _apiHandlers: { [apiName: string]: ((call: ApiCall) => any) | undefined } = {};
    // 多个Handler将异步并行执行
    private _msgHandlers = new HandlerManager();

    readonly logger!: Logger;

    constructor(options: ServerOptions) {
        this._options = options;
        this.tsbuffer = new TSBuffer(this._options.proto.types);
        this.serviceMap = this._getServiceMap(this._options.proto);
    }

    private _getServiceMap(proto: ServiceProto): ServiceMap {
        let map: ServiceMap = {
            id2Service: {},
            apiName2Service: {},
            msgName2Service: {}
        }

        for (let v of proto.services) {
            map.id2Service[v.id] = v;
            if (v.type === 'api') {
                map.apiName2Service[v.name] = v;
            }
            else {
                map.msgName2Service[v.name] = v;
            }
        }

        return map;
    }

    // #region Data process flow
    async onData(conn: any, data: Buffer) {
        // Decrypt
        let buf: Uint8Array;
        if (this._options.decrypter) {
            buf = await this._options.decrypter(data);
        }
        else {
            buf = data;
        }

        // Parse RPC Call
        let call: BaseCall;
        try {
            call = this._makeCall(conn, buf);
        }
        catch (e) {
            this.logger.error('Buffer cannot be resolved.', e);
            return;
        }

        // Handle Call
        if (call.type === 'api') {
            this._handleApi(call);
            this._afterApi(call);
        }
        else {
            this._handleMsg(call);
            this._afterMsg(call);
        }
    }

    private async _execFlow(flow: ((...args: any[]) => boolean | Promise<boolean>)[], params: any): Promise<{ continue: boolean, err?: Error }> {
        for (let i = 0; i < flow.length; ++i) {
            try {
                let res = flow[i](params);
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
            call.logger.log('[API_FLOW_ERR]', op.err);
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
                call.logger.log('[API_FLOW_ERR]', op.err);
                call.error('Internal server error', 'INTERNAL_ERR');
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
                call.logger.error('[API_ERR]', e);
                if (e instanceof TsrpcError) {
                    call.error(e.message, e.info);
                }
                else {
                    call.error('Internal server error', 'INTERNAL_ERR');
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
        PrefixLogger.pool.put(call.logger);
    }
    protected _afterMsg(call: MsgCall): void;
    // #endregion    

    // #region Api/Msg handler register
    // API 只能实现一次
    implementApi<T extends keyof ServiceType['req']>(apiName: T, handler: ApiHandler<ServiceType['req'][T], ServiceType['res'][T]>) {
        if (this._apiHandlers[apiName as string]) {
            throw new Error('Already exist handler for API: ' + apiName);
        }
        this._apiHandlers[apiName as string] = handler;
    };

    autoImplementApi(apiPath: string, apiNamePrefix?: string): { succ: string[], fail: string[] } {
        // this.autoImpl('api/userApi', 'user')

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
            try {
                let module = require(path.resolve(apiPath, handlerPath, 'Api' + handlerName));
                // ApiName同名
                apiHandler = module['Api' + handlerName];
            }
            catch{ }

            if (!apiHandler) {
                output.fail.push(svc.name);
                this.logger.warn('Auto implement api fail: ' + svc.name);
                continue;
            }

            this.implementApi(svc.name, apiHandler as any);
            this.logger.log('Auto implement api succ: ' + svc.name);
            output.succ.push(svc.name);
        }

        return output;
    }

    // Msg 可以重复监听
    listenMsg<T extends keyof ServiceType['msg']>(msgName: T, handler: MsgHandler<ServiceType['msg'][T]>) {
        this._msgHandlers.addHandler(msgName as string, handler);
    };

    unlistenMsg<T extends keyof ServiceType['msg']>(msgName: T, handler?: MsgHandler<ServiceType['msg'][T]>) {
        this._msgHandlers.removeHandler(msgName as string, handler);
    };
    // #endregion   

}

export const defualtBaseServerOptions: BaseServerOptions = {
    proto: { services: [], types: {} },
    logger: console
}

export interface BaseServerOptions {
    proto: ServiceProto;
    logger: Logger;
    encrypter?: (src: Uint8Array) => Uint8Array | Promise<Uint8Array>;
    decrypter?: (cipher: Uint8Array) => Uint8Array | Promise<Uint8Array>;
}

export type ApiHandler<Req = any, Res = any> = (call: ApiCall<Req, Res>) => void | Promise<void>;
export type MsgHandler<Msg = any> = (msg: MsgCall<Msg>) => void | Promise<void>;

export interface ServiceMap {
    id2Service: { [serviceId: number]: ServiceDef },
    apiName2Service: { [apiName: string]: ApiServiceDef | undefined },
    msgName2Service: { [msgName: string]: MsgServiceDef | undefined }
}