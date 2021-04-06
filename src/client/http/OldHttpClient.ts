import http from "http";
import https from "https";
import { TSBuffer } from "tsbuffer";
import { ApiReturn, BaseServiceType, Logger, ServiceProto, TsrpcError, TsrpcErrorType } from "tsrpc-proto";
import { Counter } from '../../models/Counter';
import { Flow } from "../../models/Flow";
import { nodeUtf8 } from '../../models/nodeUtf8';
import { ServiceMap, ServiceMapUtil } from '../../models/ServiceMapUtil';
import { ParsedServerOutput, TransportDataUtil } from '../../models/TransportDataUtil';
import { BaseClientOptions } from "../models/BaseClient";
import { CallApiFlowData, SendMsgFlowData } from "../models/ClientFlowData";
import { PromiseOptions, PromiseUtil } from "../models/PromiseUtil";
import { TransportOptions } from "../models/TransportOptions";

export class HttpClient<ServiceType extends BaseServiceType = any>  {

    readonly options: HttpClientOptions = {
        ...defaultHttpClientOptions
    };

    readonly serviceMap: ServiceMap;
    readonly tsbuffer: TSBuffer;
    readonly logger?: Logger;

    readonly flows = {
        // callApi
        preCallApiFlow: new Flow<CallApiFlowData<ServiceType>>(),
        preApiReturnFlow: new Flow<CallApiFlowData<ServiceType>>(),
        postCallApiFlow: new Flow<CallApiFlowData<ServiceType>>(),

        // sendMsg
        preSendMsgFlow: new Flow<SendMsgFlowData<ServiceType>>(),
        postSendMsgFlow: new Flow<SendMsgFlowData<ServiceType>>(),

        // buffer
        preSendBufferFlow: new Flow<Uint8Array>(),
        preRecvBufferFlow: new Flow<Uint8Array>(),
    } as const;

    private _http: typeof http | typeof https;
    private _snCounter = new Counter(1);

    lastReceivedBuf?: Uint8Array;

    constructor(proto: ServiceProto<ServiceType>, options?: Partial<HttpClientOptions>) {
        Object.assign(this.options, options);
        this.serviceMap = ServiceMapUtil.getServiceMap(proto);
        this.tsbuffer = new TSBuffer(proto.types, {
            utf8Coder: nodeUtf8
        });
        this.logger = this.options.logger;
        this._http = this.options.server.startsWith('https://') ? https : http;
        this.logger?.log('TSRPC HTTP Client :', this.options.server);
    }

    callApi<T extends keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], options: TransportOptions = {}): Promise<ApiReturn<ServiceType['api'][T]['res']>> & { abort(): void } {
        let promiseOptions: PromiseOptions = {};
        let output = PromiseUtil.enableAbort(
            this._callApi(apiName, req, options, promiseOptions)
                // Friendly log
                .catch(e => {
                    this.logger?.error(e);
                    // Canceled
                    return new Promise(rs => { }) as any;
                })
                .then(v => {
                    if (v.isSucc) {
                        this.logger?.log(`[ApiRes] #${promiseOptions.sn!}`, v.res);
                    }
                    else {
                        (v.err.type === TsrpcErrorType.ApiError || v.err.type === TsrpcErrorType.ServerError ?
                            this.logger?.log
                            : this.logger?.error)?.(`[ApiErr] #${promiseOptions.sn!}`, v.err);
                    }
                    return v;
                })
        );
        return output;
    }

    private async _callApi<T extends keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], options: TransportOptions, promiseOptions: PromiseOptions): Promise<ApiReturn<ServiceType['api'][T]['res']>> {
        // Pre Flow
        let pre = await this.flows.preCallApiFlow.exec({
            apiName: apiName,
            req: req,
            options: options
        }, this.logger);
        if (!pre) {
            throw 'Canceled by Flow: preCallApiFlow';
        }

        let sn = this._snCounter.getNext();
        promiseOptions.sn = sn;
        this.logger?.log(`[ApiReq] #${sn}`, apiName, req);

        // returned from pre flow
        if (pre.res) {
            return pre.res;
        }

        // GetService
        let service = this.serviceMap.apiName2Service[apiName as string];
        if (!service) {
            return {
                isSucc: false,
                err: new TsrpcError('Invalid api name: ' + apiName, {
                    code: 'INVALID_SERVICE_NAME',
                    type: TsrpcErrorType.ClientError
                })
            }
        }

        // Encode
        let opEncode = TransportDataUtil.encodeApiReq(this.tsbuffer, service, req);
        if (!opEncode.isSucc) {
            return {
                isSucc: false, err: new TsrpcError(opEncode.errMsg, {
                    type: TsrpcErrorType.ClientError,
                    code: 'INVALID_REQ'
                })
            };
        }

        // Send
        let opSend = await this._sendBuf(opEncode.buf, options, 'api', sn);
        return this._sendBuf(opEncode.buf, options, 'api', sn).then(resBuf => {
            if (!resBuf) {
                throw new TsrpcError('Unknown Error', {
                    code: 'EMPTY_RES',
                    isServerError: true
                })
            }

            // Parsed res
            let parsed: ParsedServerOutput;
            try {
                parsed = TransportDataUtil.parseServerOutout(this.tsbuffer, this.serviceMap, resBuf);
            }
            catch (e) {
                throw new TsrpcError('Invalid server output', {
                    code: 'INVALID_SERVER_OUTPUT',
                    isServerError: true,
                    innerError: e,
                    buf: resBuf
                });
            }
            if (parsed.type !== 'api') {
                throw new TsrpcError('Invalid response', {
                    code: 'INVALID_API_ID',
                    isServerError: true
                });
            }
            if (parsed.isSucc) {
                this.logger?.log(`[ApiRes] #${sn}`, parsed.res)
                return parsed.res;
            }
            else {
                this.logger?.log(`[ApiErr] #${sn}`, parsed.error)
                throw parsed.error;
            }
        })
    }

    sendMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T], options: TransportOptions = {}): SuperPromise<void, TsrpcError> {
        let sn = this._snCounter.getNext();
        this.logger?.log(`[SendMsg] #${sn}`, msgName, msg);

        // GetService
        let service = this.serviceMap.msgName2Service[msgName as string];
        if (!service) {
            throw new TsrpcError('Invalid msg name: ' + msgName, {
                code: 'INVALID_SERVICE_NAME',
                isClientError: true
            });
        }

        let buf = TransportDataUtil.encodeMsg(this.tsbuffer, service, msg);
        return this._sendBuf(buf, options, 'msg').then(() => { })
    }


    // protected _onRecvBuf(buf: Uint8Array) { };
    protected async _sendBuf(buf: Uint8Array, options: TransportOptions = {}, type: 'api' | 'msg', sn: number, promiseOptions: PromiseOptions): Promise<{ isSucc: true, buf: Uint8Array } | { isSucc: false, err: TsrpcError }> {
        // Pre Flow
        let pre = await this.flows.preSendBufferFlow.exec(buf, this.logger);
        if (!pre) {
            throw 'Canceled by Flow: preSendBufferFlow';
        }
        buf = pre;

        // Do Send
        this.options.debugBuf && this.logger?.debug('[SendBuf]', '#' + sn, buf);

        let httpReq: http.ClientRequest;

        let promiseRj: Function;
        let promise = new Promise<{ isSucc: true, buf: Uint8Array } | { isSucc: false, err: TsrpcError }>((rs, rj) => {
            promiseRj = rj;
            httpReq = this._http.request(this.options.server, {
                method: 'POST',
                agent: this.options.agent
            }, httpRes => {
                let data: Buffer[] = [];
                httpRes.on('data', (v: Buffer) => {
                    data.push(v)
                });
                httpRes.on('end', () => {
                    let buf: Uint8Array = Buffer.concat(data)
                    this.lastReceivedBuf = buf;

                    this.options.debugBuf && this.logger?.debug('[RecvBuf]', '#' + sn, buf);
                    rs({ isSucc: true, buf: buf });
                })
            });

            httpReq.on('abort', () => {
                if (!promise.isDone) {
                    this.logger?.log(`[${type === 'api' ? 'ApiCancel' : 'MsgCancel'}] #${sn}`)
                }
            });

            httpReq.on('error', e => {
                // abort 不算错误
                if (promise.isCanceled) {
                    return;
                }

                rj(new TsrpcError(e.message, {
                    code: (e as any).code,
                    isNetworkError: true
                }));
            })

            httpReq.write(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength));
            httpReq.end();
        });

        promiseOptions.onAbort = () => {
            httpReq.abort()
        }

        let timer: NodeJS.Timeout | undefined;
        let timeout = options.timeout || this.options.timeout;
        if (timeout) {
            timer = setTimeout(() => {
                if (!promise.isCanceled && !promise.isDone) {
                    this.logger?.log(`[${type === 'api' ? 'ApiTimeout' : 'MsgTimeout'}] #${sn}`);
                    promiseRj(new TsrpcError('Request Timeout', {
                        code: 'TIMEOUT',
                        isNetworkError: true
                    }));
                    httpReq.abort();
                }
            }, timeout);
        }

        promise.then(v => {
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
            return v;
        });

        promise.catch(e => {
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
            throw e;
        })

        return promise;
    }

}

