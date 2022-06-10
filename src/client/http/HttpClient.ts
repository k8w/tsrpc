import http from "http";
import https from "https";
import { BaseHttpClient, BaseHttpClientOptions, defaultBaseHttpClientOptions } from "tsrpc-base-client";
import { BaseServiceType, ServiceProto } from "tsrpc-proto";
import { getClassObjectId } from "../../models/getClassObjectId";
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
            customObjectIdClass: getClassObjectId(),
            ...defaultHttpClientOptions,
            ...options
        });

        httpProxy.agent = this.options.agent;
    }

}

const defaultHttpClientOptions: HttpClientOptions = {
    ...defaultBaseHttpClientOptions
}

export interface HttpClientOptions extends BaseHttpClientOptions {
    /** NodeJS HTTP Agent */
    agent?: http.Agent | https.Agent;
}