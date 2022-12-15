import { BaseServiceType, ServiceProto } from "tsrpc-base";
import { BaseWsClient, BaseWsClientOptions, defaultBaseWsClientOptions } from "tsrpc-base-client";
import { defaultBaseNodeClientOptions } from "../models/BaseNodeClientOptions";
import { getClassObjectId } from "../models/getClassObjectId";
import { TSRPC_VERSION } from "../models/version";
import { wsClientTransport } from "./wsClientTransport";

export class WsClient<ServiceType extends BaseServiceType = any> extends BaseWsClient<ServiceType> {

    declare options: WsClientOptions;

    constructor(proto: ServiceProto<ServiceType>, options?: Partial<WsClientOptions>) {
        super(proto, {
            ...defaultWsClientOptions,
            ...options
        }, {
            classObjectId: getClassObjectId(),
            env: {
                tsrpc: TSRPC_VERSION,
                node: process.version
            },
            transport: wsClientTransport
        });
    }

}

export const defaultWsClientOptions: BaseWsClientOptions = {
    ...defaultBaseWsClientOptions,
    ...defaultBaseNodeClientOptions,
}

export interface WsClientOptions extends BaseWsClientOptions {

}