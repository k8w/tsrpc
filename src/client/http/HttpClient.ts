import http from "http";
import https from "https";
import { BaseServiceType, ServiceProto, TsrpcError, TsrpcErrorType } from "tsrpc-proto";
import { BaseClient, BaseClientOptions, defaultBaseClientOptions, PendingApiItem } from "../models/BaseClient";
import { TransportOptions } from "../models/TransportOptions";

export class HttpClient<ServiceType extends BaseServiceType> extends BaseClient<ServiceType> {

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

    lastReceivedBuf?: Uint8Array;

    protected async _sendBuf(buf: Uint8Array, options: TransportOptions, serviceId?: number, pendingApiItem?: PendingApiItem): Promise<{ err?: TsrpcError | undefined; }> {
        let sn = pendingApiItem?.sn;
        let promise = new Promise<{ err?: TsrpcError | undefined; }>(async rs => {
            // Pre Flow
            let pre = await this.flows.preSendBufferFlow.exec(buf, this.logger);
            if (!pre) {
                return;
            }
            buf = pre;

            // Do Send
            this.options.debugBuf && this.logger?.debug('[SendBuf]' + (sn ? (' #' + sn) : ''), `length=${buf.byteLength}`, buf);

            let httpReq: http.ClientRequest;
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

                    this.options.debugBuf && this.logger?.debug('[RecvBuf]' + (sn ? (' #' + sn) : ''), 'length=' + buf.byteLength, buf);
                    this._onRecvBuf(buf, serviceId, sn)
                })
            });

            httpReq.on('error', e => {
                if (pendingApiItem?.isAborted) {
                    return;
                }

                this.logger?.error('HTTP Req Error:', e);
                rs({
                    err: new TsrpcError(e.message, {
                        type: TsrpcErrorType.NetworkError,
                        code: (e as any).code
                    })
                });
            });

            httpReq.write(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength));
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
    server: 'http://localhost:3000'
}

export interface HttpClientOptions extends BaseClientOptions {
    /** Server URL */
    server: string;
    /** NodeJS HTTP Agent */
    agent?: http.Agent | https.Agent;
}