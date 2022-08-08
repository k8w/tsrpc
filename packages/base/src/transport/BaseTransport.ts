import { Chalk } from "../models/Chalk";
import { Counter } from "../models/Counter";
import { EventEmitter } from "../models/EventEmitter";
import { Flow } from "../models/Flow";
import { Logger, LogLevel } from "../models/Logger";
import { OpResult } from "../models/OpResult";
import { ServiceMap } from "../models/ServiceMapUtil";
import { TransportOptions } from "../models/TransportOptions";
import { ApiReturn } from "../proto/ApiReturn";
import { BaseServiceType } from "../proto/BaseServiceType";
import { TransportData } from "../proto/TransportData";
import { ProtoInfo, TsrpcErrorType } from "../proto/TransportDataSchema";
import { TsrpcError } from "../proto/TsrpcError";
import { TransportFlows } from "./TransportFlows";

export const PROMISE_ABORTED = new Promise<any>(rs => { });

/**
 * BaseTransport
 * - Server have many connections (BaseTransport)
 *   - Http/Ws/Udp Connection
 * - Client is a BaseTransport
 *   - Http/Ws/Udp Client
 *     - HttpClient don't have `listenMsg` and `implementApi`
 */
export abstract class BaseTransport<ServiceType extends BaseServiceType = any> {

    declare ServiceType: ServiceType;

    options?: Partial<BaseTransportOptions>;
    getOption<T extends keyof BaseTransportOptions>(key: T): BaseTransportOptions[T] {
        return this.options?.[key] ?? defaultBaseTransportOptions[key];
    }

    /**
     * {@link Flow} to process `callApi`, `sendMsg`, buffer input/output, etc...
     */
    protected flows: TransportFlows<this>;
    serviceMap: ServiceMap;
    logger?: Logger;
    chalk: Chalk;
    protected _localProtoInfo: ProtoInfo;
    protected _remoteProtoInfo?: ProtoInfo;

    constructor(options: Partial<BaseTransportOptions>) {
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
        // SN & Log
        let sn = this._callApiSn.getNext();
        this.getOption('logApi') && this.logger?.log(`[CallApi] [#${sn}] ${this.chalk('[Req]', ['info'])} ${this.chalk(`[${apiName}]`, ['gray'])}`, this.getOption('logReqBody') ? req : '');

        // Create PendingApiItem
        let pendingItem: PendingApiItem = {
            sn,
            apiName,
            req,
            abortKey: options?.abortKey,
            abortSignal: options?.abortSignal,
        };
        this._pendingApis.set(sn, pendingItem);

        // AbortSignal
        if (options?.abortSignal) {
            options.abortSignal.addEventListener('abort', () => {
                this.abort(sn);
            })
        }

        // PreSend Flow
        let preSend = await this.flows.preSendReqFlow.exec({ apiName, req, conn: this }, this.logger);
        if (!preSend || pendingItem.isAborted) {
            this.abort(pendingItem.sn);
            return PROMISE_ABORTED;
        }

        // Get Return
        let ret = preSend.ret ?? await this._doCallApi(preSend.apiName, preSend.req, pendingItem, options);

        // Aborted, skip return.
        if (pendingItem.isAborted) {
            return PROMISE_ABORTED;
        }

        // PreRecv Flow (before return)
        let preRecv = await this.flows.preRecvRetFlow.exec({
            ...preSend,
            ret: ret
        }, this.logger);
        if (!preRecv || pendingItem.isAborted) {
            this.abort(pendingItem.sn);
            return PROMISE_ABORTED;
        }
        ret = preRecv.ret;

        // Log Return
        if (this.getOption('logApi')) {
            if (ret.isSucc) {
                this.logger?.log(`[CallApi] [#${pendingItem.sn}] ${this.chalk('[Res]', ['info'])} ${this.chalk(`[${apiName}]`, ['gray'])}`, this.getOption('logResBody') ? ret.res : '');
            }
            else {
                this.logger?.[ret.err.type === TsrpcError.Type.ApiError ? 'log' : 'error'](`[CallApi] [#${pendingItem.sn}] ${this.chalk('[Err]', [TsrpcError.Type.ApiError ? 'warn' : 'error'])} ${this.chalk(`[${apiName}]`, ['gray'])}`, ret.err);
            }
        }

        this._pendingApis.delete(pendingItem.sn);
        return ret;
    }

    protected async _doCallApi<T extends string & keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], pendingItem: PendingApiItem, options?: TransportOptions): Promise<ApiReturn<ServiceType['api'][T]['res']>> {
        // Make TransportData
        let transportData: TransportData = {
            type: 'req',
            apiName,
            sn: this.nextSn,
            req: req
        }
        // Exchange Proto Info
        if (!this._remoteProtoInfo) {
            transportData.protoInfo = this._localProtoInfo;
        }

        // Send & Recv
        let promiseSend = this._sendTransportData(transportData, options);
        let promiseReturn = this._waitApiReturn(pendingItem, options?.timeout ?? this.getOption('apiTimeout'));

        // Encode or Send Error
        let opSend = await promiseSend;
        if (!opSend.isSucc) {
            return {
                isSucc: false,
                err: opSend.err
            };
        }

        // PostSend Flow
        this.flows.postSendReqFlow.exec({ apiName, req, conn: this }, this.logger);

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
        this.getOption('logApi') && this.logger?.log(`[CallApi] [#${pendingItem.sn}] ${this.chalk('[Abort]', ['info'])} ${this.chalk(`[${pendingItem.apiName}]`, ['gray'])}`);

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
            conn: this
        }, this.logger);
        if (!pre) {
            return PROMISE_ABORTED;
        }
        msgName = pre.msgName as any;
        msg = pre.msg as any;

        // The msg is not prevented by pre flow
        this.getOption('logMsg') && this.logger?.log(`[SendMsg]`, msgName, msg);

        // Encode & Send
        let opResult = await this._sendTransportData({
            type: 'msg',
            msgName,
            msg
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

    protected _validateTransportData(transportData: TransportData, skipTypeCheck?: boolean): OpResult<void> {
        // req msg type safe?
        throw new Error('TODO')
    }

    /**
     * Achieved by the implemented Connection.
     * @param transportData Type haven't been checked, need to be done inside.
     */
    protected async _sendTransportData(transportData: TransportData, options?: TransportOptions): Promise<OpResult<void>> {
        // Validate
        let op = await this._validateTransportData(transportData, this.getOption('skipSendTypeCheck'));
        if (!op.isSucc) {
            return op;
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
    protected async _recvTransportData(transportData: TransportData): Promise<void> {
        // Validate
        let op = await this._validateTransportData(transportData, this.getOption('skipRecvTypeCheck'));
        if (!op.isSucc) {
            // TODO Log
            return;
        }

        // Sync remote protoInfo
        if ((transportData.type === 'req' || transportData.type === 'ret') && transportData.protoInfo) {
            this._remoteProtoInfo = transportData.protoInfo;
        }

        switch (transportData.type) {
            case 'req': {
                // Get Service
                const service = this.serviceMap.apiName2Service[transportData.apiName];
                if (!service) {
                    // TODO
                    // call.error('Undefined api name: xxxxx')
                    // this._sendTransportData({});
                    return;
                }

                // Make Call
                let call = new ApiCall(this, transportData, service);

                // TODO PreFlow
                let pre = await this.flows.preRecvReqFlow.exec(call, this.logger)
                if (!pre) {
                    // TODO
                    return;
                }
                // Return by pre flow
                call = pre;
                if (call.ret) {
                    // TODO
                    return;
                }

                // Get Handler
                const handler = this._apiHandlers[transportData.apiName];
                if (!handler) {
                    // TODO
                    call.error('API not implemented', { type: TsrpcErrorType.ServerError })
                    return;
                }

                // Exec
                handler(call);
                break;
            }
            case 'ret': {
                // TODO pendingApiItem
                const item = this._pendingApis.get(transportData.sn);
                if (!item) {
                    // TODO
                    console.error('Invalid SN');
                    return;
                }
                if (item.isAborted) {
                    return;
                }

                // Pre Flow
                let pre = await this.flows.preRecvRetFlow.exec({
                    apiName: item.apiName,
                    req: item.req,
                    ret: transportData.ret,
                    conn: this
                }, this.logger);
                if (!pre || item.isAborted) {
                    return;
                }

                item.onReturn?.(pre.ret)
                break;
            }
            case 'msg': {
                // TODO
                // preRecvMsgFlow
                // MsgHandlers
                break;
            }
            case 'heartbeat': {
                // TODO
                // this.heartbeatManager.recv(heartbeatSn)
                break;
            }

        }
    };

    // #endregion
}

export const defaultBaseTransportOptions: BaseTransportOptions = {

} as any

export interface BaseTransportOptions {
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

export interface PendingApiItem {
    sn: number,
    apiName: string,
    req: any,
    isAborted?: boolean,
    abortKey?: string,
    abortSignal?: AbortSignal,
    onAbort?: () => void,
    onReturn?: (ret: ApiReturn<any>) => void
}

export type ApiHandler<Conn extends BaseTransport> = (call: ApiCall<any, any, Conn>) => (void | Promise<void>);
export type MsgHandler<Conn extends BaseTransport, MsgName extends keyof Conn['ServiceType']['msg']>
    = (call: MsgCall<MsgName, Conn>) => void | Promise<void>;

export interface IHeartbeatManager {
    // TODO
    // TCP / UDP 机制不同
}