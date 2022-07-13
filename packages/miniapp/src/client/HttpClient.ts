import { BaseHttpClient, BaseHttpClientOptions, defaultBaseHttpClientOptions } from "tsrpc-base-client";
import { BaseServiceType, ServiceProto } from "tsrpc-proto";
import { HttpProxy } from "./HttpProxy";

/**
 * Client for TSRPC HTTP Server.
 * It uses native http module of NodeJS.
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

        httpProxy.miniappObj = this.options.miniappObj;
    }

}

const defaultHttpClientOptions: HttpClientOptions = {
    ...defaultBaseHttpClientOptions,
    miniappObj: typeof wx !== 'undefined' ? wx : undefined as any,
    customObjectIdClass: String,
}

export interface HttpClientOptions extends BaseHttpClientOptions {
    /**
     * MiniApp API Object
     * @remarks
     * - Wechat: `wx`
     * - QQ MiniApp: `qq`
     * - ByteDance MiniApp: `tt`
     * @defaultValue `wx`
     */
    miniappObj: any
}