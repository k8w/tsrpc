import { BaseHttpClient, BaseHttpClientOptions, defaultBaseHttpClientOptions, TransportOptions } from "tsrpc-base-client";
import { ApiReturn, BaseServiceType, ServiceProto, TsrpcError } from "tsrpc-proto";
import { HttpProxy } from './HttpProxy';

/**
 * HTTP Client for TSRPC.
 * It uses XMLHttpRequest to send requests.
 * @typeParam ServiceType - `ServiceType` from generated `proto.ts`
 */
export class HttpClient<ServiceType extends BaseServiceType> extends BaseHttpClient<ServiceType> {

    readonly options!: Readonly<HttpClientOptions>;

    constructor(proto: ServiceProto<ServiceType>, options?: Partial<HttpClientOptions>) {
        let httpProxy = new HttpProxy;
        super(proto, httpProxy, {
            ...defaultHttpClientOptions,
            ...options
        });
    }

    callApi<T extends string & keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], options: HttpClientTransportOptions = {}): Promise<ApiReturn<ServiceType['api'][T]['res']>> {
        return super.callApi(apiName, req, options);
    };

    sendMsg<T extends string & keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T], options: HttpClientTransportOptions = {}): Promise<{ isSucc: true } | { isSucc: false, err: TsrpcError }> {
        return super.sendMsg(msgName, msg, options);
    }

}

export interface HttpClientTransportOptions extends TransportOptions {
    /**
     * Event when progress of data sent is changed
     * @param ratio - 0~1
     */
    onProgress?: (ratio: number) => void;
}

const defaultHttpClientOptions: HttpClientOptions = {
    ...defaultBaseHttpClientOptions,
    customObjectIdClass: String,
}

export interface HttpClientOptions extends BaseHttpClientOptions {

}