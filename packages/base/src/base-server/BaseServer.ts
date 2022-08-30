import { TSBuffer } from "tsbuffer";
import { BaseConnectionDataType, BaseConnectionOptions, defaultBaseConnectionOptions } from "../base/BaseConnection";
import { Chalk } from "../models/Chalk";
import { getCustomObjectIdTypes } from "../models/getCustomObjectIdTypes";
import { Logger, LogLevel, setLogLevel } from "../models/Logger";
import { ServiceMap, ServiceMapUtil } from "../models/ServiceMapUtil";
import { BaseServiceType } from "../proto/BaseServiceType";
import { ServiceProto } from "../proto/ServiceProto";
import { ProtoInfo } from "../proto/TransportDataSchema";

/**
 * Abstract base class for TSRPC Server.
 * Implement on a transportation protocol (like HTTP WebSocket) by extend it.
 * @typeParam ServiceType - `ServiceType` from generated `proto.ts`
 */
export abstract class BaseServer<ServiceType extends BaseServiceType = BaseServiceType>{

    // Options
    readonly logger: Logger;
    readonly chalk: Chalk;
    readonly serviceMap: ServiceMap;
    readonly tsbuffer: TSBuffer;

    /**
     * Start the server
     * @throws
     */
    abstract start(): Promise<void>;

    /**
     * Stop server immediately, not waiting for the requests ending.
     */
    abstract stop(): Promise<void>;

    protected _status: ServerStatus = ServerStatus.Stopped;
    get status(): ServerStatus {
        return this._status;
    }

    constructor(
        public serviceProto: ServiceProto<ServiceType>,
        public options: BaseServerOptions,
        privateOptions: PrivateBaseServerOptions
    ) {

        this.tsbuffer = new TSBuffer({
            ...serviceProto.types,
            // Support mongodb/ObjectId
            ...getCustomObjectIdTypes(privateOptions.classObjectId)
        }, {
            strictNullChecks: options.strictNullChecks,
            skipEncodeValidate: options.skipEncodeValidate,
            skipDecodeValidate: options.skipDecodeValidate,
        });
        this.serviceMap = ServiceMapUtil.getServiceMap(serviceProto);
        this.logger = setLogLevel(this.options.logger, this.options.logLevel);
        this.chalk = options.chalk;
    }

}

export const defaultBaseServerOptions: BaseServerOptions = {
    ...defaultBaseConnectionOptions,
    defaultDataType: 'text',
    allowedDataTypes: ['text', 'buffer'],
    strictNullChecks: false,
    logLevel: 'debug',
}

export interface BaseServerOptions extends BaseConnectionOptions {
    /** @defaultValue 'text' */
    defaultDataType: BaseConnectionDataType,
    /** @defaultValue ['text', 'buffer'] */
    allowedDataTypes: BaseConnectionDataType[],

    logLevel: LogLevel,

    // TSBufferOptions
    strictNullChecks: boolean,

    // #region Deprecated
    /** @deprecated Use `allowedDataTypes` instead */
    json?: never,
    /** @deprecated Use `allowedDataTypes` instead */
    jsonEnabled?: never,
    /** @deprecated Use `apiCallTimeout` instead */
    apiTimeout?: never,
    /** @deprecated Use `apiReturnInnerError` instead */
    returnInnerError?: boolean;
    // #endregion
}

export enum ServerStatus {
    Starting = 'Starting',
    Started = 'Started',
    Stopping = 'Stopping',
    Stopped = 'Stopped',
}

export interface PrivateBaseServerOptions {
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