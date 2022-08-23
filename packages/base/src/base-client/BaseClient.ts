import { TSBuffer } from "tsbuffer";
import { BaseConnection, BaseConnectionOptions, defaultBaseConnectionOptions } from "../base/BaseConnection";
import { getCustomObjectIdTypes } from "../models/getCustomObjectIdTypes";
import { ServiceMapUtil } from "../models/ServiceMapUtil";
import { BaseServiceType } from "../proto/BaseServiceType";
import { ServiceProto } from "../proto/ServiceProto";
import { BaseClientFlows } from "./BaseClientFlows";

export abstract class BaseClient<ServiceType extends BaseServiceType = any> extends BaseConnection<ServiceType> {

    flows: BaseClientFlows<this, ServiceType> = {} as any;

    constructor(serviceProto: ServiceProto<ServiceType>, options: BaseClientOptions, privateOptions: PrivateBaseClientOptions) {
        const serviceMap = ServiceMapUtil.getServiceMap(serviceProto);
        const tsbuffer = new TSBuffer({
            ...serviceProto.types,
            ...getCustomObjectIdTypes(privateOptions.classObjectId)
        });
        super(options, serviceMap, tsbuffer, {
            lastModified: serviceProto.lastModified,
            md5: serviceProto.md5,
            tsrpcVersion: privateOptions.tsrpcOptions,
            ...(privateOptions.nodeVersion ? { nodeVersion: privateOptions.nodeVersion } : undefined)
        })
    }

    // #region 3.x API 向后兼容
    /** @deprecated Use `this.options.dataType` instead. */
    declare dataType: never;

    private _DEPRECATED_msgHandlers = new WeakMap<Function, Function>();
    /** @deprecated Use `onMsg` instead. */
    listenMsg = this.onMsg;
    /** @deprecated Use `offMsg` instead. */
    unlistenMsg = this.offMsg;
    /** @deprecated Use `offMsg` instead. */
    unlistenMsgAll<T extends string & keyof ServiceType['msg']>(msgName: T | RegExp) {
        this.offMsg(msgName);
    }
    // #endregion

}

export const defaultBaseClientOptions: BaseClientOptions = {
    ...defaultBaseConnectionOptions
}

export interface BaseClientOptions extends BaseConnectionOptions {
    /** @deprecated Use `dataType` instead. */
    json?: never;
    /** @deprecated Use `callApiTimeout` instead. */
    timeout?: never;
}

/**
 * Only for extends usage
 */
export interface PrivateBaseClientOptions {
    /**
     * 自定义 mongodb/ObjectId 的反序列化类型
     * 传入 `String`，则会反序列化为字符串
     * 传入 `ObjectId`, 则会反序列化为 `ObjectId` 实例
     * 若为 `false`，则不会自动对 ObjectId 进行额外处理
     * 将会针对 'mongodb/ObjectId' 'bson/ObjectId' 进行处理
     */
    classObjectId: { new(id?: any): any };

    /** NodeJS version (if it is) */
    nodeVersion?: string;

    tsrpcOptions: string;
}