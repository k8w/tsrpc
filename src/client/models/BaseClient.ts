import { SuperPromise } from "k8w-super-promise";
import { TSBuffer } from "tsbuffer";
import { ApiReturn, BaseServiceType, Logger, ServiceProto, TsrpcError, TsrpcErrorType } from "tsrpc-proto";
import { Counter } from '../../models/Counter';
import { Flow } from "../../models/Flow";
import { nodeUtf8 } from '../../models/nodeUtf8';
import { ApiService, ServiceMap, ServiceMapUtil } from '../../models/ServiceMapUtil';
import { TransportDataUtil } from "../../models/TransportDataUtil";
import { TransportOptions } from "../models/TransportOptions";
import { ApiReturnFlowData, CallApiFlowData, SendMsgFlowData } from "./ClientFlowData";

export abstract class BaseClient<ServiceType extends BaseServiceType> {

    readonly options: BaseClientOptions = {
        ...defaultBaseClientOptions
    };

    readonly serviceMap: ServiceMap;
    readonly tsbuffer: TSBuffer;
    readonly logger?: Logger;

    readonly flows = {
        // callApi
        preCallApiFlow: new Flow<CallApiFlowData<ServiceType>>(),
        preApiReturnFlow: new Flow<ApiReturnFlowData<ServiceType>>(),
        postApiReturnFlow: new Flow<ApiReturnFlowData<ServiceType>>(),

        // sendMsg
        preSendMsgFlow: new Flow<SendMsgFlowData<ServiceType>>(),
        postSendMsgFlow: new Flow<SendMsgFlowData<ServiceType>>(),

        // buffer
        preSendBufferFlow: new Flow<Uint8Array>(),
        preRecvBufferFlow: new Flow<Uint8Array>(),
    } as const;

    private _callApiSnCounter = new Counter(1);

    constructor(proto: ServiceProto<ServiceType>, options?: Partial<BaseClientOptions>) {
        Object.assign(this.options, options);
        this.serviceMap = ServiceMapUtil.getServiceMap(proto);
        this.tsbuffer = new TSBuffer(proto.types, {
            utf8Coder: nodeUtf8
        });
        this.logger = this.options.logger;
    }

    async callApi<T extends keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], options: TransportOptions = {}): SuperPromise<ApiReturn<ServiceType['api'][T]['res']>> {
        let promiseDoCall: SuperPromise<ApiReturn<ServiceType['api'][T]['res']>> | undefined;
        let promise = new SuperPromise<ApiReturn<ServiceType['api'][T]['res']>>(async rs => {
            // Pre Call Flow
            let pre = await this.flows.preCallApiFlow.exec({
                apiName: apiName,
                req: req,
                options: options
            }, this.logger);
            if (!pre || promise.isAborted) {
                promise.abort();
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
                promiseDoCall = this._doCallApi(pre.apiName, pre.req, pre.options);
                ret = await promiseDoCall;
            }
            promise.onAbort = undefined;
            if (promise.isAborted) {
                return;
            }

            // Pre Return Flow
            let preReturn = await this.flows.preApiReturnFlow.exec({
                ...pre,
                return: ret
            }, this.logger);
            if (!preReturn) {
                promise.abort();
                return;
            }

            rs(preReturn.return!);

            // Post Flow
            this.flows.postApiReturnFlow.exec(preReturn, this.logger);
        });

        promise.onAbort = () => {
            promiseDoCall?.abort();
        }

        return promise;
    }

    protected async _doCallApi<T extends keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], options: TransportOptions = {}): SuperPromise<ApiReturn<ServiceType['api'][T]['res']>> {
        let promiseSend: SuperPromise<{ err?: TsrpcError }> | undefined;
        let sn = this._callApiSnCounter.getNext();
        this.logger?.log(`[ApiReq] #${sn}`, apiName, req);

        let promise = new SuperPromise<ApiReturn<ServiceType['api'][T]['res']>>(async rs => {
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

            // Encode
            let opEncode = TransportDataUtil.encodeApiReq(this.tsbuffer, service, req);
            if (!opEncode.isSucc) {
                rs({
                    isSucc: false, err: new TsrpcError(opEncode.errMsg, {
                        type: TsrpcErrorType.ClientError,
                        code: 'ENCODE_REQ_ERR'
                    })
                });
                return;
            }

            // Send Buf...
            let promiseReturn = this._waitApiReturn(sn, service, options.timeout);
            let promiseSend = this._sendBuf(opEncode.buf, options, service.id, sn);
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
            if (promise.isAborted) {
                return;
            }

            if (ret.isSucc) {
                this.logger?.log(`[ApiRes] #${sn} ${apiName}`, ret.res);
            }
            else {
                this.logger?.log(`[ApiErr] #${sn} ${apiName}`, ret.err);
            }

            rs(ret);
        });

        promise.onAbort = () => {
            this.logger?.log(`[ApiAbort] #${sn} ${apiName}`)
            this._apiReturnListeners.removeOne(v => v.sn === sn);
            promiseSend?.abort();
        }

        return promise;
    }

    /**
     * @param msgName 
     * @param msg 
     * @param options 
     * @returns 异步返回的结果仅代表服务器收到了Msg或主动关闭了链接
     * 不代表服务器正确的处理了请求
     */
    sendMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T], options: TransportOptions = {}): SuperPromise<{ isSucc: true } | { isSucc: false, err: TsrpcError }> {
        let promiseSendBuf: SuperPromise<{ err?: TsrpcError }> | undefined;
        let promise = new SuperPromise<{ isSucc: true } | { isSucc: false, err: TsrpcError }>(async rs => {
            // Pre Flow
            let pre = await this.flows.preSendMsgFlow.exec({
                msgName: msgName,
                msg: msg,
                options: options
            }, this.logger);
            if (!pre) {
                promise.abort();
                return;
            }

            // The msg is not prevented by pre flow
            this.logger?.log(`[SendMsg]`, msgName, msg);

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
            let opEncode = TransportDataUtil.encodeMsg(this.tsbuffer, service, msg);
            if (!opEncode.isSucc) {
                rs({
                    isSucc: false,
                    err: new TsrpcError(opEncode.errMsg, {
                        type: TsrpcErrorType.ClientError,
                        code: 'ENCODE_REQ_ERR'
                    })
                });
                return;
            }

            // Send Buf...
            let promiseSend = this._sendBuf(opEncode.buf, options, service.id);
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
        promise.onAbort = () => {
            this.logger?.log(`[MsgAbort] ${msgName}`, msg);
            promiseSendBuf?.abort();
        }

        return promise;
    }

    /**
     * Send buffer
     * Long connection: wait res by listenning `conn.onmessage`
     * Short connection: wait res by waitting response
     * @param buf 
     * @param options 
     * @param sn 
     */
    protected abstract _sendBuf(buf: Uint8Array, options: TransportOptions, serviceId?: number, sn?: number): SuperPromise<{ err?: TsrpcError }>;

    protected async _onRecvBuf(buf: Uint8Array, serviceId?: number, sn?: number) {
        // Pre Flow
        let pre = await this.flows.preRecvBufferFlow.exec(buf, this.logger);
        if (!pre) {
            return;
        }
        buf = pre;

        // Parse
        let opParsed = TransportDataUtil.parseServerOutout(this.tsbuffer, this.serviceMap, buf, serviceId);
        if (opParsed.isSucc) {
            let parsed = opParsed.result;
            if (parsed.type === 'api') {
                sn = sn ?? parsed.sn;
                // call ApiReturn listeners
                this._apiReturnListeners.find(v => v.sn === sn)?.listener(parsed.ret);
            }
        }
        else {
            this.logger?.warn('Cannot parse server output buffer: ' + opParsed.errMsg);
        }
    }

    /**
     * ApiReturn事件监听
     * buf发出后创建，ret收回或取消后移除
     * 对于一个SN，是唯一的
     */
    protected _apiReturnListeners: { sn: number, service: ApiService, listener: (ret: ApiReturn<any>) => void }[] = [];
    /**
     * 
     * @param sn 
     * @param timeout 
     * @returns `undefined` 代表 canceled
     */
    protected async _waitApiReturn(sn: number, service: ApiService, timeout?: number): Promise<ApiReturn<any>> {
        return new Promise<ApiReturn<any>>(rs => {
            // Timeout
            let timer: ReturnType<typeof setTimeout> | undefined;
            if (timeout) {
                timer = setTimeout(() => {
                    timer = undefined;
                    this._apiReturnListeners.removeOne(v => v.sn === sn);
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
            this._apiReturnListeners.push({
                sn: sn,
                service: service,
                listener: ret => {
                    if (timer) {
                        clearTimeout(timer);
                        timer = undefined;
                    }
                    this._apiReturnListeners.removeOne(v => v.sn === sn);
                    rs(ret);
                }
            });
        });
    }

}

export const defaultBaseClientOptions: BaseClientOptions = {
    logger: console
}

export interface BaseClientOptions {
    /** 
     * 打印日志使用的 Logger
     * 为 `undefined` 时会隐藏所有日志
     * 默认：`console`
     */
    logger?: Logger;
    /** 
     * 请求超时时间（毫秒）
     * 为 `undefined` 即为不限时间
     * 默认：`undefined`
     */
    timeout?: number;
    /** 为true时将会把buf信息打印在log中 */
    debugBuf?: boolean
}


