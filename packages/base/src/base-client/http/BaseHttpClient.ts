import { TransportData } from "../../base/TransportData";
import { OpResult } from "../../models/OpResult";
import { TransportOptions } from "../../models/TransportOptions";
import { ApiReturn } from "../../proto/ApiReturn";
import { BaseServiceType } from "../../proto/BaseServiceType";
import { ServiceProto } from "../../proto/ServiceProto";
import { TsrpcError } from "../../proto/TsrpcError";
import { BaseClient, BaseClientOptions, defaultBaseClientOptions, PrivateBaseClientOptions } from "../BaseClient";
import { HttpRequest } from "./IHttpRequest";

export class BaseHttpClient<ServiceType extends BaseServiceType> extends BaseClient<ServiceType> {

    declare readonly options: BaseHttpClientOptions;
    protected _request: HttpRequest;

    constructor(serviceProto: ServiceProto<ServiceType>, options: Partial<BaseHttpClientOptions> | undefined, privateOptions: PrivateBaseHttpClientOptions) {
        super(serviceProto, {
            ...defaultBaseHttpClientOptions,
            ...options
        }, privateOptions);

        this._request = privateOptions.request;
        this.logger.log('TSRPC HTTP Client :', this.options.server);
    }

    protected _sendData(data: string | Uint8Array, transportData: TransportData, options?: TransportOptions): Promise<OpResult<void>> {
        let promise = (async (): Promise<{ err: TsrpcError | undefined; res?: undefined } | { res: string | Uint8Array, err?: undefined }> => {
            // Send to this URL
            const serviceName = 'serviceName' in transportData ? transportData.serviceName : '';
            const url = (typeof data === 'string' && serviceName)
                ? `${this.options.server}${this.options.server.endsWith('/') ? '' : '/'}${serviceName}`
                : this.options.server;

            // Do Send
            let { promise: fetchPromise, abort } = this._request({
                url: url,
                data: data,
                method: 'POST',
                timeout: options?.timeout || this.options.callApiTimeout,
                headers: {
                    'Content-Type': typeof data === 'string' ? 'application/json' : 'application/octet-stream',
                    ...(transportData.type === 'msg' || transportData.type === 'custom' ? {
                        'X-TSRPC-DATA-TYPE': transportData.type,
                    } : undefined),
                    ...('protoInfo' in transportData && transportData.protoInfo ? {
                        'X-TSRPC-PROTO-INFO': JSON.stringify(transportData.protoInfo)
                    } : undefined)
                },
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

    // #region HTTP not supported APIs
    /** HTTP client do not support duplex callApi */
    declare implementApi: never;
    /** HTTP client not support listen Msg, please use `WsClient` instead. */
    declare onMsg: never;
    /** HTTP client not support listen Msg, please use `WsClient` instead. */
    declare off: never;
    /** HTTP client not support listen Msg, please use `WsClient` instead. */
    declare listenMsg: never;
    /** HTTP client not support listen Msg, please use `WsClient` instead. */
    declare unlistenMsg: never;
    // #endregion

}

export const defaultBaseHttpClientOptions: BaseHttpClientOptions = {
    ...defaultBaseClientOptions,
    server: 'http://127.0.0.1:3000',
    heartbeat: false,
    apiCallTimeout: -1
}

export interface BaseHttpClientOptions extends BaseClientOptions {
    /** Server URL, starts with `http://` or `https://`. */
    server: string;

    encodeReturnText?: (ret: ApiReturn<any>) => string,
    decodeReturnText?: (data: string) => ApiReturn<any>,

    /** HTTP do not need heartbeat */
    heartbeat: false,

    /** HTTP client do not support duplex callApi */
    apiCallTimeout: -1
}

export interface PrivateBaseHttpClientOptions extends PrivateBaseClientOptions {
    request: HttpRequest
}