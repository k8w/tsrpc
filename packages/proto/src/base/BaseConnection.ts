import { Overwrite } from "k8w-extend-native";
import { Chalk } from "../models/Chalk";
import { Counter } from "../models/Counter";
import { EventEmitter } from "../models/EventEmitter";
import { Flow } from "../models/Flow";
import { Logger, LogLevel } from "../models/Logger";
import { OpResult } from "../models/OpResult";
import { ApiService, ServiceMap } from "../models/ServiceMapUtil";
import { TransportOptions } from "../models/TransportOptions";
import { ApiReturn } from "../proto/ApiReturn";
import { BaseServiceType } from "../proto/BaseServiceType";
import { ProtoInfo, TransportDataSchema, TsrpcErrorType } from "../proto/TransportDataSchema";
import { TsrpcError } from "../proto/TsrpcError";
import { ApiCall } from "./ApiCall";
import { BaseConnectionFlows } from "./FlowData";
import { MsgCall } from "./MsgCall";

export const PROMISE_ABORTED = new Promise<any>(rs => { });

/**
 * BaseConnection
 * - Server have many connections (BaseConnection)
 *   - Http/Ws/Udp Connection
 * - Client is a BaseConnection
 *   - Http/Ws/Udp Client
 *     - HttpClient don't have `listenMsg` and `implementApi`
 */
export abstract class BaseConnection<ServiceType extends BaseServiceType = any> {

    declare ServiceType: ServiceType;

    options?: Partial<BaseConnectionOptions>;
    getOption<T extends keyof BaseConnectionOptions>(key: T): BaseConnectionOptions[T] {
        return this.options?.[key] ?? defaultBaseConnectionOptions[key];
    }

    /**
     * {@link Flow} to process `callApi`, `sendMsg`, buffer input/output, etc...
     */
    protected flows: BaseConnectionFlows<this>;
    serviceMap: ServiceMap;
    logger?: Logger;
    chalk: Chalk;
    protected _localProtoInfo: ProtoInfo;
    protected _remoteProtoInfo?: ProtoInfo;

    constructor(options: Partial<BaseConnectionOptions>) {
        this.options = options;
        // TODO
        // TEST
        this.serviceMap = null as any;
        this.flows = null as any;
        this.logger = null as any;
        this.chalk = null as any;
        this._localProtoInfo = null!;
    }

    // #region API Client

    protected _callApiSn = new Counter(1);
    protected _pendingApis = new Map<number, PendingApiItem>;

    get lastSn() {
        return this._callApiSn.last;
    }

    get nextSn() {
        return this._callApiSn.getNext(true);
    }

    /**
     * Send request and wait for the return
     * @param apiName
     * @param req - Request body
     * @param options - Transport options
     * @returns return a `ApiReturn`, all error (network error, business error, code exception...) is unified as `TsrpcError`.
     * The promise is never rejected, so you just need to process all error in one place.
     */
    async callApi<T extends string & keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], options?: TransportOptions): Promise<ApiReturn<ServiceType['api'][T]['res']>> {
        // Create PendingApiItem
        let sn = this._callApiSn.getNext();
        let pendingItem: PendingApiItem = {
            sn: sn,
            abortKey: options?.abortKey,
            abortSignal: options?.abortSignal,
            service: this.serviceMap.apiName2Service[apiName as string]!
        };
        this._pendingApis.set(sn, pendingItem);

        // AbortSignal
        if (options?.abortSignal) {
            options.abortSignal.addEventListener('abort', () => {
                this.abort(sn);
            })
        }

        // Pre Call Flow
        let pre = await this.flows.preCallApiFlow.exec({
            apiName: apiName,
            req: req,
            options: options,
            conn: this
        }, this.logger);
        if (!pre || pendingItem.isAborted) {
            this.abort(pendingItem.sn);
            return PROMISE_ABORTED;
        }

        // Get Return
        let ret = pre.return ?? await this._doCallApi(pre.apiName, pre.req, pendingItem, pre.options);

        // Aborted, skip return.
        if (pendingItem.isAborted) {
            return PROMISE_ABORTED;
        }

        // Log Original Return
        if (ret.isSucc) {
            this.getOption('logApi') && this.logger?.log(`[callApi] [#${pendingItem.sn}] ${this.chalk('[Res]', ['info'])} ${this.chalk(`[${apiName}]`, ['gray'])}`, this.getOption('logResBody') ? ret.res : '');
        }
        else {
            this.getOption('logApi') && this.logger?.[ret.err.type === TsrpcError.Type.ApiError ? 'log' : 'error'](`[callApi] [#${pendingItem.sn}] ${this.chalk('[Err]', [TsrpcError.Type.ApiError ? 'warn' : 'error'])} ${this.chalk(`[${apiName}]`, ['gray'])}`, ret.err);
        }

        // Post Flow (before return)
        let post = await this.flows.postCallApiFlow.exec({
            ...pre,
            return: ret
        }, this.logger);
        if (!post || pendingItem.isAborted) {
            this.abort(pendingItem.sn);
            return PROMISE_ABORTED;
        }

        this._pendingApis.delete(pendingItem.sn);
        return post.return;
    }

    protected async _doCallApi<T extends string & keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], pendingItem: PendingApiItem, options?: TransportOptions): Promise<ApiReturn<ServiceType['api'][T]['res']>> {
        this.getOption('logApi') && this.logger?.log(`[callApi] [#${pendingItem.sn}] ${this.chalk('[Req]', ['info'])} ${this.chalk(`[${apiName}]`, ['gray'])}`, this.getOption('logReqBody') ? req : '');

        // GetService
        let service = this.serviceMap.apiName2Service[apiName as string];
        if (!service) {
            return {
                isSucc: false,
                err: new TsrpcError('Invalid api name: ' + apiName, {
                    code: 'INVALID_API_NAME',
                    type: TsrpcErrorType.ClientError
                })
            };
        }
        pendingItem.service = service;

        // Make TransportData
        let transportData: TransportData = {
            type: 'req',
            sn: this.nextSn,
            serviceId: service.id,
            data: req
        }
        // Exchange Proto Info
        if (!this._remoteProtoInfo) {
            transportData.protoInfo = this._localProtoInfo;
        }

        // Send & Recv
        let promiseSend = this._sendTransportData(transportData, options);
        let promiseReturn = this._waitApiReturn(pendingItem, options?.timeout ?? this.getOption('apiTimeout'));

        // Encode Error
        let opSend = await promiseSend;
        if (!opSend.isSucc) {
            return {
                isSucc: false,
                err: opSend.err
            };
        }

        // Wait ApiReturn
        let ret = await promiseReturn;
        return pendingItem.isAborted ? PROMISE_ABORTED : ret;
    }

    /**
     * @param sn 
     * @param timeout 
     * @returns `undefined` 代表 canceled
     */
    protected async _waitApiReturn(pendingItem: PendingApiItem, timeout?: number): Promise<ApiReturn<any>> {
        return new Promise<ApiReturn<any>>(rs => {
            // Timeout
            let timer: ReturnType<typeof setTimeout> | undefined;

            if (timeout) {
                timer = setTimeout(() => {
                    timer = undefined;
                    this._pendingApis.delete(pendingItem.sn);
                    rs({
                        isSucc: false,
                        err: new TsrpcError('Request Timeout', {
                            type: TsrpcErrorType.NetworkError,
                            code: 'TIMEOUT'
                        })
                    })
                }, timeout);
            }

            // Listener (trigger by `this._onRecvBuf`)
            pendingItem.onReturn = ret => {
                if (timer) {
                    clearTimeout(timer);
                    timer = undefined;
                }
                this._pendingApis.delete(pendingItem.sn);
                rs(ret);
            }
        });
    }

    /**
     * Abort a pending API request, it makes the promise returned by `callApi()` neither resolved nor rejected forever.
     * @param sn - Every api request has a unique `sn` number, you can get it by `this.lastSN` 
     */
    abort(sn: number): void {
        // Find and Clear
        let pendingItem = this._pendingApis.get(sn);
        if (!pendingItem) {
            return;
        }
        this._pendingApis.delete(sn);

        // Log
        this.getOption('logApi') && this.logger?.log(`[callApi] [#${pendingItem.sn}] ${this.chalk('[Abort]', ['info'])} ${this.chalk(`[${pendingItem.service.name}]`, ['gray'])}`);

        // onAbort
        pendingItem.onReturn = undefined;
        pendingItem.isAborted = true;
        pendingItem.onAbort?.();
    }
    /**
     * Abort all API requests that has the `abortKey`.
     * It makes the promise returned by `callApi` neither resolved nor rejected forever.
     * @param abortKey - The `abortKey` of options when `callApi()`, see {@link TransportOptions.abortKey}.
     * @example
     * ```ts
     * // Send API request many times
     * client.callApi('SendData', { data: 'AAA' }, { abortKey: 'Session#123' });
     * client.callApi('SendData', { data: 'BBB' }, { abortKey: 'Session#123' });
     * client.callApi('SendData', { data: 'CCC' }, { abortKey: 'Session#123' });
     *
     * // And abort the at once
     * client.abortByKey('Session#123');
     * ```
     */
    abortByKey(abortKey: string) {
        this._pendingApis.forEach(v => {
            if (v.abortKey === abortKey) {
                this.abort(v.sn)
            }
        })
    }
    /**
     * Abort all pending API requests.
     * It makes the promise returned by `callApi` neither resolved nor rejected forever.
     */
    abortAll() {
        this._pendingApis.forEach(v => this.abort(v.sn));
    }
    // #endregion

    // #region API Server

    protected _apiHandlers: Record<string, ApiHandler<this> | undefined> = {};

    /**
     * Associate a `ApiHandler` to a specific `apiName`.
     * So that when `ApiCall` is receiving, it can be handled correctly.
     * @param apiName
     * @param handler
     */
    implementApi<Api extends string & keyof ServiceType['api']>(apiName: Api, handler: ApiHandler<any>): void {
        if (this._apiHandlers[apiName as string]) {
            throw new Error('Already exist handler for API: ' + apiName);
        }
        this._apiHandlers[apiName as string] = handler;
        this.logger?.log(`API implemented succ: ${this.chalk(apiName, ['underline'])}`);
    };

    // #endregion

    // #region Message

    protected _msgHandlers = new EventEmitter<ServiceType['msg']>();

    /**
     * Send message, without response, not ensuring the server is received and processed correctly.
     * @param msgName
     * @param msg - Message body
     * @param options - Transport options
     * @returns If the promise is resolved, it means the request is sent to system kernel successfully.
     * Notice that not means the server received and processed the message correctly.
     */
    async sendMsg<T extends string & keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T], options?: TransportOptions): Promise<{ isSucc: true } | { isSucc: false, err: TsrpcError }> {
        let op = await this._doSendMsg(msgName, msg, options);
        if (!op.isSucc) {
            this.logger?.error(this.chalk('[SendMsgErr]', ['error']), op.err);
        }
        return op;
    }
    protected async _doSendMsg<T extends string & keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T], options?: TransportOptions): Promise<{ isSucc: true } | { isSucc: false, err: TsrpcError }> {
        // Pre Flow
        let pre = await this.flows.preSendMsgFlow.exec({
            msgName: msgName,
            msg: msg,
            options: options,
            conn: this
        }, this.logger);
        if (!pre) {
            return PROMISE_ABORTED;
        }
        msgName = pre.msgName as any;
        msg = pre.msg as any;
        options = pre.options;

        // The msg is not prevented by pre flow
        this.getOption('logMsg') && this.logger?.log(`[SendMsg]`, msgName, msg);

        // GetService
        let service = this.serviceMap.msgName2Service[msgName as string];
        if (!service) {
            return {
                isSucc: false,
                err: new TsrpcError('Invalid msg name: ' + msgName, {
                    code: 'INVALID_MSG_NAME',
                    type: TsrpcErrorType.ClientError
                })
            };
        }

        // Encode & Send
        let opResult = await this._sendTransportData({
            type: 'msg',
            serviceId: service.id,
            data: msg
        }, options)

        // Post Flow
        if (opResult.isSucc) {
            this.flows.postSendMsgFlow.exec(pre!, this.logger);
        }

        return opResult;
    }

    /**
     * Add a message handler,
     * duplicate handlers to the same `msgName` would be ignored.
     * @param msgName
     * @param handler
     * @returns
     */
    onMsg<T extends string & keyof ServiceType['msg'], U extends MsgHandler<this, T>>(msgName: T | RegExp, handler: U, context?: any): U {
        if (msgName instanceof RegExp) {
            Object.keys(this.serviceMap.msgName2Service).filter(k => msgName.test(k)).forEach(k => {
                this._msgHandlers.on(k, handler, context)
            })
            return handler;
        }
        else {
            return this._msgHandlers.on(msgName, handler, context)
        }
    }

    onceMsg<T extends string & keyof ServiceType['msg']>(msgName: T, handler: MsgHandler<this, T>, context?: any): MsgHandler<this, T> {
        return this._msgHandlers.once(msgName, handler, context);
    };

    /**
     * Remove a message handler
     */
    offMsg<T extends string & keyof ServiceType['msg']>(msgName: T | RegExp): void;
    offMsg<T extends string & keyof ServiceType['msg']>(msgName: T | RegExp, handler: Function, context?: any): void;
    offMsg<T extends string & keyof ServiceType['msg']>(msgName: T | RegExp, handler?: Function, context?: any) {
        if (msgName instanceof RegExp) {
            Object.keys(this.serviceMap.msgName2Service).filter(k => msgName.test(k)).forEach(k => {
                handler ? this._msgHandlers.off(k, handler, context) : this._msgHandlers.off(k)
            })
        }
        else {
            handler ? this._msgHandlers.off(msgName, handler, context) : this._msgHandlers.off(msgName)
        }
    }

    // #endregion

    // #region Transport

    // 到这一步已经经过类型检测
    // DataFlow 面向二进制 Payload
    // TODO 序列化过程应该是在 Transport 之内的，不同信道（HTTP、WS、Obj）序列化方式不同
    // HTTP JSON：fetch data->body header->header serviceId->URL
    // HTTP BUF: fetch all in body
    // WS JSON: all in json body, serviceId -> service: {'data/AddData'}
    // WS BUF: all in body

    protected _validateTransportData(transportData: TransportData): OpResult<void> {
        throw new Error('TODO')
    }

    /**
     * Achieved by the implemented Connection.
     * @param transportData Type haven't been checked, need to be done inside.
     */
    protected async _sendTransportData(transportData: TransportData, options?: TransportOptions): Promise<OpResult<void>> {
        // Validate
        if (!this.getOption('skipSendTypeCheck')) {
            let op = await this._validateTransportData(transportData);
            if (!op.isSucc) {
                return op;
            }
        }

        // Do Send
        return this._doSendTransportData(transportData);
    }

    /**
     * Encode and send
     * @param transportData Type has been checked already
     */
    protected abstract _doSendTransportData(transportData: TransportData): Promise<OpResult<void>>;

    /**
     * Called by the implemented Connection.
     * @param transportData Type haven't been checked, need to be done inside.
     */
    protected async _recvTransportData(transportData: TransportData): void {
        // Validate
        if (!this.getOption('skipRecvTypeCheck')) {
            let op = await this._validateTransportData(transportData);
            if (!op.isSucc) {
                // TODO Log
                return;
            }
        }

        switch (transportData.type) {
            case 'req': {
                // TODO API Handler
                transportData.serviceId
                break;
            }
            case 'res':
            case 'err': {
                // TODO pendingApiItem
                break;
            }
            case 'msg': {
                // TODO msgHandler.emit
                break;
            }
            case 'heartbeat': {
                // TODO heartbeat manager
                break;
            }

        }
    };
    // #endregion
}

export const defaultBaseConnectionOptions: BaseConnectionOptions = {

} as any

export interface BaseConnectionOptions {
    // Log
    logger: Logger,
    chalk: Chalk,
    logLevel: LogLevel,
    logApi: boolean,
    logMsg: boolean,
    logReqBody: boolean,
    logResBody: boolean,
    debugBuf: boolean,

    // Runtime Type Check
    skipSendTypeCheck: boolean;
    skipRecvTypeCheck: boolean;

    // Serialization
    jsonEncoder: any;
    jsonDecoder: any;
    bufferEncoder: any;
    bufferDecoder: any;

    apiTimeout: number; // 兼容 timeout
}

/**
 * Basic transport unit, for transport-indepentent architecture.
 * The transport-layer should implement its serialization and transportation.
 */
export type TransportData = TransportData_RPC | TransportData_NonRPC;
export type TransportData_RPC = Overwrite<TransportDataSchema & { type: 'req' | 'res' | 'err' }, { data: any, sn: number }>
    | Overwrite<TransportDataSchema & { type: 'msg' }, { data: any }>;
export type TransportData_NonRPC = TransportDataSchema & { type: Exclude<TransportDataSchema['type'], TransportData_RPC['type']> };

export interface PendingApiItem {
    sn: number,
    service: ApiService,
    isAborted?: boolean,
    abortKey?: string,
    abortSignal?: AbortSignal,
    onAbort?: () => void,
    onReturn?: (ret: ApiReturn<any>) => void
}

export type ApiHandler<Conn extends BaseConnection> = (call: ApiCall<any, any, Conn>) => (void | Promise<void>);
export type MsgHandler<Conn extends BaseConnection, MsgName extends keyof Conn['ServiceType']['msg']>
    = (call: MsgCall<MsgName, Conn>) => void | Promise<void>;

export interface IHeartbeatManager {
    // TODO
    // TCP / UDP 机制不同
}