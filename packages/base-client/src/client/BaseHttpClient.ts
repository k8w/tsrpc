import { BaseServiceType, ServiceProto, TsrpcError } from "tsrpc-proto";
import { TransportOptions } from "../models/TransportOptions";
import { BaseClient, BaseClientOptions, defaultBaseClientOptions, PendingApiItem } from "./BaseClient";

/**
 * Base HTTP Client
 */
export class BaseHttpClient<ServiceType extends BaseServiceType> extends BaseClient<ServiceType> {

    readonly type = 'SHORT';

    private _http: IHttpProxy;
    private _jsonServer: string;

    readonly options!: Readonly<BaseHttpClientOptions>;
    constructor(proto: ServiceProto<ServiceType>, http: IHttpProxy, options?: Partial<BaseHttpClientOptions>) {
        super(proto, {
            ...defaultBaseHttpClientOptions,
            ...options
        });
        this._http = http;
        this._jsonServer = this.options.server + (this.options.server.endsWith('/') ? '' : '/');
        this.logger?.log('TSRPC HTTP Client :', this.options.server);
    }

    protected async _sendData(data: Uint8Array | string, options: TransportOptions, serviceId: number, pendingApiItem?: PendingApiItem): Promise<{ err?: TsrpcError | undefined; }> {
        let promise = (async (): Promise<{ err: TsrpcError | undefined; res?: undefined } | { res: string | Uint8Array, err?: undefined }> => {
            // Send to this URL
            const service = this.serviceMap.id2Service[serviceId];
            const urlSearch = service.type === 'msg' ? '?type=msg' : '';
            const url = typeof data === 'string' ? (this._jsonServer + service.name + urlSearch) : this.options.server;
            
            // Do Send
            let { promise: fetchPromise, abort } = this._http.fetch({
                url:url,
                data: data,
                method: 'POST',
                timeout: options.timeout || this.options.timeout,
                headers: { 'Content-Type': typeof data === 'string' ? 'application/json' : 'application/octet-stream' },
                transportOptions: options,
                responseType: typeof data === 'string' ? 'text' : 'arraybuffer',
            });

            if (pendingApiItem) {
                pendingApiItem.onAbort = () => {
                    abort();
                }
            }

            // Aborted
            if (pendingApiItem?.isAborted) {
                return new Promise(rs => { });
            }

            let fetchRes = await fetchPromise;
            if (!fetchRes.isSucc) {
                return { err: fetchRes.err };
            }
            return { res: fetchRes.res };
        })();

        promise.then(v => {
            // Msg 不需要 onRecvData
            if (pendingApiItem && v.res) {
                this._onRecvData(v.res, pendingApiItem);
            }
        })

        // Finally
        promise.catch(e => { }).then(() => {
            if (pendingApiItem) {
                pendingApiItem.onAbort = undefined;
            }
        })

        return promise;
    }
}

export const defaultBaseHttpClientOptions: BaseHttpClientOptions = {
    ...defaultBaseClientOptions,
    server: 'http://localhost:3000',
    // logger: new TerminalColorLogger(),
    jsonPrune: true
}

export interface BaseHttpClientOptions extends BaseClientOptions {
    /** Server URL, starts with `http://` or `https://`. */
    server: string;

    /**
     * Whether to automatically delete excess properties that not defined in the protocol.
     * @defaultValue `true`
     */
    jsonPrune: boolean;
}


export interface IHttpProxy {
    fetch(options: {
        url: string,
        data: string | Uint8Array,
        method: string,
        /** ms */
        timeout?: number,
        headers?: { [key: string]: string },
        transportOptions: TransportOptions,
        responseType: 'text' | 'arraybuffer'
    }): {
        abort: () => void,
        promise: Promise<{ isSucc: true, res: string | Uint8Array } | { isSucc: false, err: TsrpcError }>
    };
}