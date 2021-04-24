import http from "http";
import https from "https";
import { EncodeOutput } from "tsbuffer";
import { ApiService, BaseClient, BaseClientOptions, defaultBaseClientOptions, MsgService, PendingApiItem, TransportDataUtil, TransportOptions } from "tsrpc-base-client";
import { ApiReturn, BaseServiceType, ServiceProto, TsrpcError, TsrpcErrorType } from "tsrpc-proto";

export class HttpClient<ServiceType extends BaseServiceType> extends BaseClient<ServiceType> {

    readonly type = 'SHORT';

    private _http: typeof http | typeof https;

    readonly options!: HttpClientOptions;
    constructor(proto: ServiceProto<ServiceType>, options?: Partial<HttpClientOptions>) {
        super(proto, {
            ...defaultHttpClientOptions,
            ...options
        });
        this._http = this.options.server.startsWith('https://') ? https : http;
        this.logger?.log('TSRPC HTTP Client :', this.options.server);
    }

    protected _encodeApiReq(service: ApiService, req: any, pendingItem: PendingApiItem): EncodeOutput {
        if (this.options.json) {
            if (this.options.jsonPrune) {
                let opPrune = this.tsbuffer.prune(req, pendingItem.service.reqSchemaId);
                if (!opPrune.isSucc) {
                    return opPrune;
                }
                req = opPrune.pruneOutput;
            }
            return {
                isSucc: true,
                buf: JSON.stringify(req) as any
            }
        }
        else {
            return TransportDataUtil.encodeApiReq(this.tsbuffer, service, req, undefined);
        }
    }

    protected _encodeClientMsg(service: MsgService, msg: any): EncodeOutput {
        if (this.options.json) {
            if (this.options.jsonPrune) {
                let opPrune = this.tsbuffer.prune(msg, service.msgSchemaId);
                if (!opPrune.isSucc) {
                    return opPrune;
                }
                msg = opPrune.pruneOutput;
            }
            return {
                isSucc: true,
                buf: JSON.stringify(msg) as any
            }
        }
        else {
            return TransportDataUtil.encodeClientMsg(this.tsbuffer, service, msg);
        }
    }

    protected async _sendBuf(buf: Uint8Array, options: TransportOptions, serviceId: number, pendingApiItem?: PendingApiItem): Promise<{ err?: TsrpcError | undefined; }> {
        let sn = pendingApiItem?.sn;
        let promise = new Promise<{ err?: TsrpcError | undefined; }>(async rs => {
            // Pre Flow
            if (!this.options.json) {
                let pre = await this.flows.preSendBufferFlow.exec({ buf: buf, sn: pendingApiItem?.sn }, this.logger);
                if (!pre) {
                    return;
                }
                buf = pre.buf;
            }

            // Do Send
            this.options.debugBuf && this.logger?.debug('[SendBuf]' + (sn ? (' #' + sn) : ''), `length=${buf.length}`, buf);

            let httpReq: http.ClientRequest;
            httpReq = this._http.request(
                this.options.json ? (this.options.server + (this.options.server.endsWith('/') ? '' : '/') + this.serviceMap.id2Service[serviceId].name) : this.options.server,
                {
                    method: 'POST',
                    agent: this.options.agent,
                    timeout: options.timeout ?? this.options.timeout,
                    ...(this.options.json ? {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    } : undefined)
                },
                pendingApiItem ? httpRes => {
                    let data: Buffer[] = [];
                    httpRes.on('data', (v: Buffer) => {
                        data.push(v)
                    });
                    httpRes.on('end', () => {
                        let buf: Uint8Array = Buffer.concat(data);

                        if (this.options.json) {
                            let retStr = buf.toString();
                            let ret: ApiReturn<any>;
                            try {
                                ret = JSON.parse(retStr);
                            }
                            catch (e) {
                                ret = {
                                    isSucc: false,
                                    err: {
                                        message: retStr,
                                        type: TsrpcErrorType.ServerError
                                    }
                                }
                            }
                            if (ret.isSucc) {
                                if (this.options.jsonPrune) {
                                    let opPrune = this.tsbuffer.prune(ret.res, pendingApiItem.service.resSchemaId);
                                    if (!opPrune.isSucc) {
                                        pendingApiItem.onReturn?.({
                                            isSucc: false,
                                            err: new TsrpcError('Invalid Server Output', {
                                                type: TsrpcErrorType.ClientError,
                                                innerErr: opPrune.errMsg
                                            })
                                        });
                                        return;
                                    }
                                    ret.res = opPrune.pruneOutput;
                                }
                            }
                            else {
                                ret.err = new TsrpcError(ret.err);
                            }
                            pendingApiItem.onReturn?.(ret);
                            return;
                        }

                        this._onRecvBuf(buf, pendingApiItem)
                    })
                } : undefined
            );

            httpReq.on('error', e => {
                if (pendingApiItem?.isAborted) {
                    return;
                }

                rs({
                    err: new TsrpcError(e.message, {
                        type: TsrpcErrorType.NetworkError,
                        code: (e as any).code
                    })
                });
            });

            if (this.options.json) {
                httpReq.write(buf);
            }
            else {
                httpReq.write(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength));
            }
            httpReq.end(() => {
                rs({});
            });

            if (pendingApiItem) {
                pendingApiItem.onAbort = () => {
                    httpReq.abort();
                }
            }
        });

        promise.finally(() => {
            if (pendingApiItem) {
                pendingApiItem.onAbort = undefined;
            }
        })

        return promise;
    }

}

const defaultHttpClientOptions: HttpClientOptions = {
    ...defaultBaseClientOptions,
    server: 'http://localhost:3000',
    json: false,
    jsonPrune: true
}

export interface HttpClientOptions extends BaseClientOptions {
    /** Server URL */
    server: string;
    /** NodeJS HTTP Agent */
    agent?: http.Agent | https.Agent;
    /** 
     * Use JSON instead of Buffer
     * @defaultValue false
     */
    json: boolean;
    /**
     * 是否剔除协议中未定义的多余字段
     * 默认为 `true`
     */
    jsonPrune: boolean;
}