import { TSBuffer } from "tsbuffer";
import { BaseConnectionDataType, BaseConnectionOptions, ConnectionStatus, defaultBaseConnectionOptions } from "../base/BaseConnection";
import { Chalk } from "../models/Chalk";
import { Counter } from "../models/Counter";
import { getCustomObjectIdTypes } from "../models/getCustomObjectIdTypes";
import { Logger, LogLevel, setLogLevel } from "../models/Logger";
import { ServiceMap, ServiceMapUtil } from "../models/ServiceMapUtil";
import { ServiceProto } from "../proto/ServiceProto";
import { ProtoInfo } from "../proto/TransportDataSchema";
import { BaseServerConnection } from "./BaseServerConnection";
import { BaseServerFlows } from "./BaseServerFlows";

/**
 * Abstract base class for TSRPC Server.
 * Implement on a transportation protocol (like HTTP WebSocket) by extend it.
 * @typeParam ServiceType - `ServiceType` from generated `proto.ts`
 */
export abstract class BaseServer<Conn extends BaseServerConnection = any>{

    declare Conn: Conn;

    // TODO
    flows: BaseServerFlows<this> = null!;

    /** { [id: number]: Conn } */
    readonly connections = new Set<Conn>;

    // Options
    readonly logger: Logger;
    readonly chalk: Chalk;
    readonly serviceMap: ServiceMap;
    readonly tsbuffer: TSBuffer;
    readonly localProtoInfo: ProtoInfo

    readonly status: ServerStatus = ServerStatus.Stopped;

    constructor(
        public serviceProto: ServiceProto<Conn['ServiceType']>,
        public options: BaseServerOptions,
        privateOptions: PrivateBaseServerOptions
    ) {
        // serviceProto
        this.tsbuffer = new TSBuffer({
            ...serviceProto.types,
            ...getCustomObjectIdTypes(privateOptions.classObjectId)
        }, {
            strictNullChecks: options.strictNullChecks,
            skipEncodeValidate: options.skipEncodeValidate,
            skipDecodeValidate: options.skipDecodeValidate,
        });
        this.serviceMap = ServiceMapUtil.getServiceMap(serviceProto);
        this.localProtoInfo = {
            lastModified: serviceProto.lastModified,
            md5: serviceProto.md5,
            ...privateOptions.env
        }

        // logger
        this.logger = setLogLevel(this.options.logger, this.options.logLevel);
        this.chalk = options.chalk;
    }

    /**
     * Listen port, wait connection, and call this.onConnection()
     */
    abstract start(): Promise<void>;

    protected _connId = new Counter();
    onConnection(conn: Conn) {
        this.connections.add(conn);
        conn['_setStatus'](ConnectionStatus.Connected);

        if (this.status !== ServerStatus.Started) {
            conn['_disconnect'](false, 'Server stopped', 1001)
        }
    }

    /**
     * Stop the server
     * @param gracefulWaitTime `0` represent stop immediately, otherwise wait all API requests finished and then stop the server.
     * @returns 
     */
    async stop(gracefulWaitTime = 0): Promise<void> {
        if (this.status === ServerStatus.Stopped) {
            return;
        }

        // Stop immediately
        if (!gracefulWaitTime) {
            return this._stop();
        }

        // Graceful stop
        if (this.status === ServerStatus.Stopping) {
            return;
        }
        (this.status as ServerStatus) = ServerStatus.Stopping;
        await Promise.race([
            new Promise<void>(rs => { setTimeout(rs, gracefulWaitTime) }),
            new Promise<void>(rs => {
                // TODO
            })
        ]);
        return this._stop();
    }

    /**
     * Stop server immediately
     */
    protected abstract _stop(): void;

    // protected _gracefulStop?: {
    //     rs: () => void
    // };
    // /**
    //  * Stop the server gracefully.
    //  * Wait all API requests finished and then stop the server.
    //  * @param maxWaitTime - The max time(ms) to wait before force stop the server.
    //  * `undefined` and `0` means stop the server immediately.
    //  */
    // async stop(maxWaitTime?: number) {
    //     if (this._status !== ServerStatus.Started) {
    //         throw new Error(`Cannot gracefulStop when server status is '${this._status}'.`);
    //     }

    //     this.logger.log('[GracefulStop] Start graceful stop, waiting all ApiCall finished...')
    //     this._status = ServerStatus.Stopping;
    //     let promiseWaitApi = new Promise<void>(rs => {
    //         this._gracefulStop = {
    //             rs: rs
    //         };
    //     });

    //     return new Promise<void>(rs => {
    //         let maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
    //         if (maxWaitTime) {
    //             maxWaitTimer = setTimeout(() => {
    //                 maxWaitTimer = undefined;
    //                 if (this._gracefulStop) {
    //                     this._gracefulStop = undefined;
    //                     this.logger.log('Graceful stop timeout, stop the server directly.');
    //                     this.stop().then(() => { rs() });
    //                 }
    //             }, maxWaitTime);
    //         }

    //         promiseWaitApi.then(() => {
    //             this.logger.log('All ApiCall finished, continue stop server.');
    //             if (maxWaitTimer) {
    //                 clearTimeout(maxWaitTimer);
    //                 maxWaitTimer = undefined;
    //             }
    //             if (this._gracefulStop) {
    //                 this._gracefulStop = undefined;
    //                 this.stop().then(() => { rs() });
    //             }
    //         })
    //     })
    // }

    // TODO
    broadcastMsg() { }

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