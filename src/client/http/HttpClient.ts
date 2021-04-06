import { SuperPromise } from "k8w-super-promise";
import { BaseServiceType, ServiceProto, TsrpcError, TsrpcErrorType } from "tsrpc-proto";
import { BaseClient, BaseClientOptions, defaultBaseClientOptions } from "../models/BaseClient";
import { TransportOptions } from "../models/TransportOptions";
import http from "http";
import https from "https";
import { TerminalColorLogger } from "../../server/models/TerminalColorLogger";

export class HttpClient<ServiceType extends BaseServiceType> extends BaseClient<ServiceType> {

    private _http: typeof http | typeof https;

    readonly options: HttpClientOptions = {
        ...defaultHttpClientOptions
    }

    constructor(proto: ServiceProto<ServiceType>, options?: Partial<HttpClientOptions>) {
        super(proto, options);
        this._http = this.options.server.startsWith('https://') ? https : http;
        this.logger?.log('TSRPC HTTP Client :', this.options.server);
    }

    lastReceivedBuf?: Uint8Array;

    protected async _sendBuf(buf: Uint8Array, options: TransportOptions, serviceId?: number, sn?: number): SuperPromise<{ err?: TsrpcError | undefined; }, never> {
        let promise = new SuperPromise<{ err?: TsrpcError | undefined; }, never>(async rs => {
            // Pre Flow
            let pre = await this.flows.preSendBufferFlow.exec(buf, this.logger);
            if (!pre) {
                return;
            }
            buf = pre;

            // Do Send
            this.options.debugBuf && this.logger?.debug('[SendBuf]', '#' + sn, buf);

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

                    this.options.debugBuf && this.logger?.debug('[RecvBuf]', '#' + sn, buf);
                    this._onRecvBuf(buf, serviceId, sn)
                })
            });

            httpReq.on('error', e => {
                rs({
                    err: new TsrpcError(e.message, {
                        type: TsrpcErrorType.NetworkError,
                        code: (e as any).code
                    })
                });
            });

            httpReq.write(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength));
            httpReq.end(rs);

            promise.onAbort = () => {
                httpReq.abort();
            }
        });

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