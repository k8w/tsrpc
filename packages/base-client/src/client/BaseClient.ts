import { TSBuffer } from "tsbuffer";
import { ApiReturn, BaseServiceType, Logger, LogLevel, ServiceProto, setLogLevel, TsrpcError, TsrpcErrorType } from "tsrpc-proto";
import { ApiReturnFlowData, CallApiFlowData, RecvMsgFlowData, SendMsgFlowData } from "../models/ClientFlowData";
import { Counter } from "../models/Counter";
import { Flow } from "../models/Flow";
import { getCustomObjectIdTypes } from "../models/getCustomObjectIdTypes";
import { MsgHandlerManager } from "../models/MsgHandlerManager";
import { ApiService, ServiceMap, ServiceMapUtil } from "../models/ServiceMapUtil";
import { TransportDataUtil } from "../models/TransportDataUtil";
import { TransportOptions } from "../models/TransportOptions";
/**
 * An abstract base class for TSRPC Client,
 * which includes some common buffer process flows.
 * 
 * @remarks
 * You can implement a client on a specific transportation protocol (like HTTP, WebSocket, QUIP) by extend this.
 * 
 * @typeParam ServiceType - `ServiceType` from generated `proto.ts`
 * 
 * @see
 * {@link https://github.com/k8w/tsrpc}
 * {@link https://github.com/k8w/tsrpc-browser}
 * {@link https://github.com/k8w/tsrpc-miniapp}
 */
export abstract class BaseClient<ServiceType extends BaseServiceType> {

    /** The connection is long connection or short connection */
    abstract readonly type: 'SHORT' | 'LONG';

    readonly dataType: 'json' | 'text' | 'buffer';

    readonly options: Readonly<BaseClientOptions>;

    /** The map of all services */
    readonly serviceMap: ServiceMap;
    /** The `TSBuffer` instance for encoding, decoding, and type checking */
    readonly tsbuffer: TSBuffer;

    /**
     * `Logger` to process API Request/Response, send message, send buffer...
     * @defaultValue `console`
     */
    readonly logger?: Logger;

    protected _msgHandlers = new MsgHandlerManager();

    /**
     * {@link Flow} to process `callApi`, `sendMsg`, buffer input/output, etc...
     */
    readonly flows = {
        // callApi
        preCallApiFlow: new Flow<CallApiFlowData<ServiceType>>(),
        preApiReturnFlow: new Flow<ApiReturnFlowData<ServiceType>>(),
        postApiReturnFlow: new Flow<ApiReturnFlowData<ServiceType>>(),

        // sendMsg
        preSendMsgFlow: new Flow<SendMsgFlowData<ServiceType>>(),
        postSendMsgFlow: new Flow<SendMsgFlowData<ServiceType>>(),
        preRecvMsgFlow: new Flow<RecvMsgFlowData<ServiceType>>(),
        postRecvMsgFlow: new Flow<RecvMsgFlowData<ServiceType>>(),

        // buffer
        preSendDataFlow: new Flow<{ data: Uint8Array | string | object, sn?: number }>(),
        preRecvDataFlow: new Flow<{ data: Uint8Array | string | object, sn?: number }>(),
        /**
         * @deprecated Please use `preSendDataFlow` instead
         */
        preSendBufferFlow: new Flow<{ buf: Uint8Array, sn?: number }>(),
        /**
         * @deprecated Please use `preRecvDataFlow` instead
         */
        preRecvBufferFlow: new Flow<{ buf: Uint8Array, sn?: number }>(),

        // Connection Flows (Only for WebSocket)
        /** Before connect to WebSocket server */
        preConnectFlow: new Flow<{
            /** Return `res` to `client.connect()`, without latter connect procedure */
            return?: { isSucc: true, errMsg?: undefined } | { isSucc: false, errMsg: string }
        }>(),
        /** After WebSocket connect successfully */
        postConnectFlow: new Flow<{}>(),
        /** After WebSocket disconnected (from connected status) */
        postDisconnectFlow: new Flow<{
            /** reason parameter from server-side `conn.close(reason)` */
            reason?: string,
            /**
             * Whether is is disconnected manually by `client.disconnect()`,
             * otherwise by accident. (e.g. network error, server closed...)
             */
            isManual?: boolean
        }>(),
    } as const;

    protected _apiSnCounter = new Counter(1);
    /**
     * The `SN` number of the last `callApi()`,
     * which can be passed to `abort()` to abort an API request.
     * @example
     * ```ts
     * client.callApi('xxx', { value: 'xxx' })
     *   .then(ret=>{ console.log('succ', ret) });
     * let lastSN = client.lastSN;
     * client.abort(lastSN);
     * ```
     */
    get lastSN() {
        return this._apiSnCounter.last;
    }
    /**
     * The `SN` number of the next `callApi()`,
     * which can be passed to `abort()` to abort an API request.
     * @example
     * ```ts
     * let nextSN = client.nextSN;
     * client.callApi('xxx', { value: 'xxx' })
     * ```
     */
    get nextSN() {
        return this._apiSnCounter.getNext(true);
    }

    /**
     * Pending API Requests
     */
    protected _pendingApis: PendingApiItem[] = [];

    constructor(proto: ServiceProto<ServiceType>, options: BaseClientOptions) {
        this.options = options;
        this.serviceMap = ServiceMapUtil.getServiceMap(proto);
        this.dataType = this.options.json ? 'text' : 'buffer'

        let types = { ...proto.types };

        // Custom ObjectId handler
        if (options.customObjectIdClass) {
            types = {
                ...types,
                ...getCustomObjectIdTypes(options.customObjectIdClass)
            }
        }

        this.tsbuffer = new TSBuffer(types);
        this.logger = this.options.logger;
        this.logger && setLogLevel(this.logger, this.options.logLevel);
    }

    /**
     * Send request and wait for the return
     * @param apiName
     * @param req - Request body
     * @param options - Transport options
     * @returns return a `ApiReturn`, all error (network error, business error, code exception...) is unified as `TsrpcError`.
     * The promise is never rejected, so you just need to process all error in one place.
     */
    async callApi<T extends string & keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], options: TransportOptions = {}): Promise<ApiReturn<ServiceType['api'][T]['res']>> {
        // Add pendings
        let sn = this._apiSnCounter.getNext();
        let pendingItem: PendingApiItem = {
            sn: sn,
            abortKey: options.abortKey,
            service: this.serviceMap.apiName2Service[apiName as string]!
        };
        this._pendingApis.push(pendingItem);

        let promise = new Promise<ApiReturn<ServiceType['api'][T]['res']>>(async rs => {
            // Pre Call Flow
            let pre = await this.flows.preCallApiFlow.exec({
                apiName: apiName,
                req: req,
                options: options
            }, this.logger);
            if (!pre || pendingItem.isAborted) {
                this.abort(pendingItem.sn);
                return;
            }

            // Do call (send -> wait -> recv -> return)
            let ret: ApiReturn<ServiceType['api'][T]['res']>;
            // return by pre flow
            if (pre.return) {
                ret = pre.return;
            }
            else {
                // do call means it will send buffer via network
                ret = await this._doCallApi(pre.apiName, pre.req, pre.options, pendingItem);
            }
            if (pendingItem.isAborted) {
                return;
            }

            // Log Original Return
            if (ret.isSucc) {
                this.options.logApi && this.logger?.log(`[ApiRes] #${pendingItem.sn} ${apiName}`, ret.res);
            }
            else {
                this.options.logApi && this.logger?.[ret.err.type === TsrpcError.Type.ApiError ? 'log' : 'error'](`[ApiErr] #${pendingItem.sn} ${apiName}`, ret.err);
            }

            // Pre Return Flow
            let preReturn = await this.flows.preApiReturnFlow.exec({
                ...pre,
                return: ret
            }, this.logger);
            if (!preReturn) {
                this.abort(pendingItem.sn);
                return;
            }

            rs(preReturn.return!);

            // Post Flow
            this.flows.postApiReturnFlow.exec(preReturn, this.logger);
        });

        // Finally clear pendings
        promise.catch().then(() => {
            this._pendingApis.removeOne(v => v.sn === pendingItem.sn);
        })

        return promise;
    }

    protected async _doCallApi<T extends string & keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], options: TransportOptions = {}, pendingItem: PendingApiItem): Promise<ApiReturn<ServiceType['api'][T]['res']>> {
        this.options.logApi && this.logger?.log(`[ApiReq] #${pendingItem.sn}`, apiName, req);

        let promise = new Promise<ApiReturn<ServiceType['api'][T]['res']>>(async rs => {
            // GetService
            let service = this.serviceMap.apiName2Service[apiName as string];
            if (!service) {
                rs({
                    isSucc: false,
                    err: new TsrpcError('Invalid api name: ' + apiName, {
                        code: 'INVALID_API_NAME',
                        type: TsrpcErrorType.ClientError
                    })
                });
                return;
            }
            pendingItem.service = service;

            // Encode
            let opEncode = TransportDataUtil.encodeApiReq(this.tsbuffer, service, req, this.dataType, this.type === 'LONG' ? pendingItem.sn : undefined);
            if (!opEncode.isSucc) {
                rs({
                    isSucc: false, err: new TsrpcError(opEncode.errMsg, {
                        type: TsrpcErrorType.ClientError,
                        code: 'INPUT_DATA_ERR'
                    })
                });
                return;
            }

            // Send Buf...
            let promiseReturn = this._waitApiReturn(pendingItem, options.timeout ?? this.options.timeout);
            let promiseSend = this.sendData(opEncode.output, options, service.id, pendingItem);
            let opSend = await promiseSend;
            if (opSend.err) {
                rs({
                    isSucc: false,
                    err: opSend.err
                });
                return;
            }

            // And wait Return...
            let ret = await promiseReturn;
            if (pendingItem.isAborted) {
                return;
            }

            rs(ret);
        });

        return promise;
    }

    /**
     * Send message, without response, not ensuring the server is received and processed correctly.
     * @param msgName
     * @param msg - Message body
     * @param options - Transport options
     * @returns If the promise is resolved, it means the request is sent to system kernel successfully.
     * Notice that not means the server received and processed the message correctly.
     */
    sendMsg<T extends string & keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T], options: TransportOptions = {}): Promise<{ isSucc: true } | { isSucc: false, err: TsrpcError }> {
        let promise = new Promise<{ isSucc: true } | { isSucc: false, err: TsrpcError }>(async rs => {
            // Pre Flow
            let pre = await this.flows.preSendMsgFlow.exec({
                msgName: msgName,
                msg: msg,
                options: options
            }, this.logger);
            if (!pre) {
                return;
            }

            // The msg is not prevented by pre flow
            this.options.logMsg && this.logger?.log(`[SendMsg]`, msgName, msg);

            // GetService
            let service = this.serviceMap.msgName2Service[msgName as string];
            if (!service) {
                this.logger?.error('Invalid msg name: ' + msgName)
                rs({
                    isSucc: false,
                    err: new TsrpcError('Invalid msg name: ' + msgName, {
                        code: 'INVALID_MSG_NAME',
                        type: TsrpcErrorType.ClientError
                    })
                });
                return;
            }

            // Encode
            let opEncode = TransportDataUtil.encodeClientMsg(this.tsbuffer, service, msg, this.dataType, this.type);
            if (!opEncode.isSucc) {
                rs({
                    isSucc: false,
                    err: new TsrpcError(opEncode.errMsg, {
                        type: TsrpcErrorType.ClientError,
                        code: 'ENCODE_MSG_ERR'
                    })
                });
                return;
            }

            // Send Buf...
            let promiseSend = this.sendData(opEncode.output, options, service.id);
            let opSend = await promiseSend;
            if (opSend.err) {
                rs({
                    isSucc: false,
                    err: opSend.err
                });
                return;
            }

            rs({ isSucc: true });

            // Post Flow
            this.flows.postSendMsgFlow.exec(pre, this.logger)
        });

        promise.then(v => {
            if (!v.isSucc) {
                (this.logger ?? console).error('[SendMsgErr]', v.err);
            }
        })

        return promise;
    }

    /**
     * Add a message handler,
     * duplicate handlers to the same `msgName` would be ignored.
     * @param msgName
     * @param handler
     * @returns
     */
    // listenMsg<T extends keyof ServiceType['msg']>(msgName: T, handler: ClientMsgHandler<ServiceType, T, this>): ClientMsgHandler<ServiceType, T, this>;
    // listenMsg(msgName: RegExp, handler: ClientMsgHandler<ServiceType, keyof ServiceType['msg'], this>): ClientMsgHandler<ServiceType, keyof ServiceType['msg'], this>;
    // listenMsg(msgName: string | RegExp, handler: ClientMsgHandler<ServiceType, string, this>): ClientMsgHandler<ServiceType, string, this> {
    listenMsg<T extends keyof ServiceType['msg']>(msgName: T | RegExp, handler: ClientMsgHandler<ServiceType, T>): ClientMsgHandler<ServiceType, T> {
        if (msgName instanceof RegExp) {
            Object.keys(this.serviceMap.msgName2Service).filter(k => msgName.test(k)).forEach(k => {
                this._msgHandlers.addHandler(k, handler)
            })
        }
        else {
            this._msgHandlers.addHandler(msgName as string, handler)
        }

        return handler;
    }
    /**
     * Remove a message handler
     */
    unlistenMsg<T extends keyof ServiceType['msg']>(msgName: T | RegExp, handler: Function) {
        if (msgName instanceof RegExp) {
            Object.keys(this.serviceMap.msgName2Service).filter(k => msgName.test(k)).forEach(k => {
                this._msgHandlers.removeHandler(k, handler)
            })
        }
        else {
            this._msgHandlers.removeHandler(msgName as string, handler)
        }
    }
    /**
     * Remove all handlers from a message
     */
    unlistenMsgAll<T extends keyof ServiceType['msg']>(msgName: T | RegExp) {
        if (msgName instanceof RegExp) {
            Object.keys(this.serviceMap.msgName2Service).filter(k => msgName.test(k)).forEach(k => {
                this._msgHandlers.removeAllHandlers(k)
            })
        }
        else {
            this._msgHandlers.removeAllHandlers(msgName as string)
        }
    }

    /**
     * Abort a pending API request, it makes the promise returned by `callApi()` neither resolved nor rejected forever.
     * @param sn - Every api request has a unique `sn` number, you can get it by `this.lastSN` 
     */
    abort(sn: number): void {
        // Find
        let index = this._pendingApis.findIndex(v => v.sn === sn);
        if (index === -1) {
            return;
        }
        let pendingItem = this._pendingApis[index];
        // Clear
        this._pendingApis.splice(index, 1);
        pendingItem.onReturn = undefined;
        pendingItem.isAborted = true;

        // Log
        this.logger?.log(`[ApiAbort] #${pendingItem.sn} ${pendingItem.service.name}`)
        // onAbort
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
        this._pendingApis.filter(v => v.abortKey === abortKey).forEach(v => { this.abort(v.sn) });
    }
    /**
     * Abort all pending API requests.
     * It makes the promise returned by `callApi` neither resolved nor rejected forever.
     */
    abortAll() {
        this._pendingApis.slice().forEach(v => this.abort(v.sn));
    }

    /**
     * Send data (binary or text)
     * @remarks
     * Long connection: wait res by listenning `conn.onmessage`
     * Short connection: wait res by waitting response
     * @param data 
     * @param options 
     * @param sn 
     */
    async sendData(data: Uint8Array | string | object, options: TransportOptions, serviceId: number, pendingApiItem?: PendingApiItem): Promise<{ err?: TsrpcError }> {
        // Pre Flow
        let pre = await this.flows.preSendDataFlow.exec({ data: data, sn: pendingApiItem?.sn }, this.logger);
        if (!pre) {
            return new Promise(rs => { });
        }
        data = pre.data;

        // @deprecated PreSendBufferFlow
        if (data instanceof Uint8Array) {
            let preBuf = await this.flows.preSendBufferFlow.exec({ buf: data, sn: pendingApiItem?.sn }, this.logger);
            if (!preBuf) {
                return new Promise(rs => { });
            }
            data = preBuf.buf;
        }

        // debugBuf log
        if (this.options.debugBuf) {
            if (typeof data === 'string') {
                this.logger?.debug('[SendText]' + (pendingApiItem ? (' #' + pendingApiItem.sn) : '') + ` length=${data.length}`, data);
            }
            else if (data instanceof Uint8Array) {
                this.logger?.debug('[SendBuf]' + (pendingApiItem ? (' #' + pendingApiItem.sn) : '') + ` length=${data.length}`, data);
            }
            else {
                this.logger?.debug('[SendJSON]' + (pendingApiItem ? (' #' + pendingApiItem.sn) : ''), data);
            }
        }

        return this._sendData(data, options, serviceId, pendingApiItem);
    }
    protected abstract _sendData(data: Uint8Array | string | object, options: TransportOptions, serviceId: number, pendingApiItem?: PendingApiItem): Promise<{ err?: TsrpcError }>;

    // 信道可传输二进制或字符串
    protected async _onRecvData(data: Uint8Array | string | object, pendingApiItem?: PendingApiItem) {
        let sn = pendingApiItem?.sn;

        // Pre Flow
        let pre = await this.flows.preRecvDataFlow.exec({ data: data, sn: sn }, this.logger);
        if (!pre) {
            return;
        }
        data = pre.data;

        if (typeof data === 'string') {
            this.options.debugBuf && this.logger?.debug('[RecvText]' + (sn ? (' #' + sn) : ''), data);
        }
        else if (data instanceof Uint8Array) {
            this.options.debugBuf && this.logger?.debug('[RecvBuf]' + (sn ? (' #' + sn) : ''), 'length=' + data.length, data);

            // @deprecated
            // Pre Flow
            let pre = await this.flows.preRecvBufferFlow.exec({ buf: data, sn: sn }, this.logger);
            if (!pre) {
                return;
            }
            data = pre.buf;
        }
        else {
            this.options.debugBuf && this.logger?.debug('[RecvJSON]' + (sn ? (' #' + sn) : ''), data);
        }

        // Parse
        let opParsed = TransportDataUtil.parseServerOutout(this.tsbuffer, this.serviceMap, data, pendingApiItem?.service.id);
        if (!opParsed.isSucc) {
            this.logger?.error('ParseServerOutputError: ' + opParsed.errMsg);
            if (data instanceof Uint8Array) {
                this.logger?.error('Please check the version of serviceProto between server and client');
            }
            if (pendingApiItem) {
                pendingApiItem.onReturn?.({
                    isSucc: false,
                    err: new TsrpcError('Parse server output error', { type: TsrpcErrorType.ServerError })
                })
            }
            return;
        }

        let parsed = opParsed.result;
        if (parsed.type === 'api') {
            sn = sn ?? parsed.sn;
            // call ApiReturn listeners
            this._pendingApis.find(v => v.sn === sn)?.onReturn?.(parsed.ret);
        }
        else if (parsed.type === 'msg') {
            this.options.logMsg && this.logger?.log(`[RecvMsg] ${parsed.service.name}`, parsed.msg)

            // Pre Flow
            let pre = await this.flows.preRecvMsgFlow.exec({ msgName: parsed.service.name, msg: parsed.msg }, this.logger);
            if (!pre) {
                return;
            }

            this._msgHandlers.forEachHandler(pre.msgName, this.logger, pre.msg, pre.msgName);

            // Post Flow
            await this.flows.postRecvMsgFlow.exec(pre, this.logger);
        }
    }

    /** @deprecated Please use `_onRecvData` instead */
    protected _onRecvBuf: (buf: Uint8Array, pendingApiItem?: PendingApiItem) => Promise<void> = this._onRecvData;

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
                    this._pendingApis.removeOne(v => v.sn === pendingItem.sn);
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
                this._pendingApis.removeOne(v => v.sn === pendingItem.sn);
                rs(ret);
            }
        });
    }

}

export const defaultBaseClientOptions: BaseClientOptions = {
    logLevel: 'debug',
    logApi: true,
    logMsg: true,
    json: false,
    timeout: 15000,
    debugBuf: false
}

export interface BaseClientOptions {
    /**
     * `Logger` to process API Request/Response, send message, send buffer...
     * If it is assigned to `undefined`, all log would be hidden. (It may be useful when you want to encrypt the transportation)
     * @defaultValue `console`
     */
    logger?: Logger;

    /**
     * The minimum log level of `logger`
     * @defaultValue `debug`
     */
    logLevel: LogLevel;

    /**
     * Whether to log [ApiReq] and [ApiRes] by the `logger`.
     * NOTICE: if `logger` is `undefined`, no log would be printed.
     * @defaultValue `true`
     */
    logApi: boolean,

    /**
     * Whether to log [SendMsg] and [RecvMsg] by the `logger`.
     * NOTICE: if `logger` is `undefined`, no log would be printed.
     * @defaultValue `true`
     */
    logMsg: boolean,

    /**
     * Use JSON instead of binary as transfering format.
     * JSON transportation also support ArrayBuffer / Date / ObjectId.
     * @defaultValue `false`
     */
    json: boolean;

    /** 
     * Timeout time for `callApi` (ms)
     * `undefined` or `0` means unlimited
     * @defaultValue `15000`
     */
    timeout: number;
    /**
     * If `true`, all sent and received raw buffer would be print into the log.
     * It may be useful when you do something for buffer encryption/decryption, and want to debug them.
     * @defaultValue `false`
     */
    debugBuf: boolean,

    /**
     * 自定义 mongodb/ObjectId 的反序列化类型
     * 传入 `String`，则会反序列化为字符串
     * 传入 `ObjectId`, 则会反序列化为 `ObjectId` 实例
     * 若为 `false`，则不会自动对 ObjectId 进行额外处理
     * 将会针对 'mongodb/ObjectId' 'bson/ObjectId' 进行处理
     */
    customObjectIdClass?: { new(id?: any): any } | false;
}

export interface PendingApiItem {
    sn: number,
    abortKey: string | undefined,
    service: ApiService,
    isAborted?: boolean,
    onAbort?: () => void,
    onReturn?: (ret: ApiReturn<any>) => void
}

export type ClientMsgHandler<ServiceType extends BaseServiceType, MsgName extends keyof ServiceType['msg']>
    = (msg: ServiceType['msg'][MsgName], msgName: MsgName) => void | Promise<void>;