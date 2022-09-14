import { TSBuffer } from "tsbuffer";
import { BaseServiceType, BaseConnection, ServiceProto, ServiceMapUtil, getCustomObjectIdTypes, setLogLevel, defaultBaseConnectionOptions, BaseConnectionOptions, BaseConnectionDataType, LogLevel, ProtoInfo } from "tsrpc-base";
import { BaseClientFlows } from "./BaseClientFlows";

/**
 * An abstract base class for TSRPC Client,
 * which includes some common buffer process flows.
 * 
 * @remarks
 * You can implement a client on a specific transportation protocol (like HTTP, WebSocket, QUIP) by extend this.
 * 
 * @typeParam ServiceType - `ServiceType` from generated `proto.ts`
 * 
 * @see
 * {@link https://github.com/k8w/tsrpc}
 * {@link https://github.com/k8w/tsrpc-browser}
 * {@link https://github.com/k8w/tsrpc-miniapp}
 */
export abstract class BaseClient<ServiceType extends BaseServiceType = any> extends BaseConnection<ServiceType> {

    declare readonly options: BaseClientOptions;

    // TODO
    flows: BaseClientFlows<this> = {} as any;

    constructor(serviceProto: ServiceProto<ServiceType>, options: BaseClientOptions, privateOptions: PrivateBaseClientOptions) {
        const serviceMap = ServiceMapUtil.getServiceMap(serviceProto);
        const tsbuffer = new TSBuffer({
            ...serviceProto.types,
            ...getCustomObjectIdTypes(privateOptions.classObjectId)
        }, {
            strictNullChecks: options.strictNullChecks,
            skipEncodeValidate: options.skipEncodeValidate,
            skipDecodeValidate: options.skipDecodeValidate,
        });
        options.logger = setLogLevel(options.logger, options.logLevel)
        super(options.dataType, options, {
            serviceMap,
            tsbuffer,
            localProtoInfo: {
                lastModified: serviceProto.lastModified,
                md5: serviceProto.md5,
                ...privateOptions.env
            }
        })
    }

    // #region Deprecated 3.x API
    /** @deprecated Use `this.options.dataType` instead. */
    declare dataType: never;

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
    ...defaultBaseConnectionOptions,
    dataType: 'text',
    logLevel: 'warn',
    strictNullChecks: false
}

export interface BaseClientOptions extends BaseConnectionOptions {
    dataType: BaseConnectionDataType,

    /** @defaultValue 'warn' */
    logLevel: LogLevel,

    // TSBufferOptions
    strictNullChecks: boolean,

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

    env: Pick<ProtoInfo, 'tsrpc' | 'node'>;
}