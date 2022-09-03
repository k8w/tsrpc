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

    protected _status: ServerStatus = ServerStatus.Stopped;

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

        if (this._status !== ServerStatus.Started) {
            conn['_disconnect'](false, 'Server stopped')
        }
    }

    protected _pendingApiCallNum = 0;
    protected _rsGracefulStop?: () => void;
    /**
     * Stop the server
     * @param gracefulWaitTime `undefined` represent stop immediately, otherwise wait all API requests finished and then stop the server.
     * @returns 
     */
    async stop(gracefulWaitTime?: number): Promise<void> {
        // Graceful stop (wait all ApiCall finished)
        if (gracefulWaitTime) {
            this._status = ServerStatus.Stopping;
            let timeout!: ReturnType<typeof setTimeout>;
            await Promise.race([
                new Promise<void>(rs => { timeout = setTimeout(rs, gracefulWaitTime) }),    // Max wait time
                new Promise<void>(rs => {
                    // Mark all conns as disconnecting
                    this.connections.forEach(v => { v['_setStatus'](ConnectionStatus.Disconnecting) });
                    this._rsGracefulStop = rs;
                })
            ]);
            // Clear
            clearTimeout(timeout);
            this._rsGracefulStop = undefined;
        }

        // Do Stop (immediately)
        this._status = ServerStatus.Stopped;
        this.connections.forEach(conn => { conn['_disconnect'](true, 'Server stopped') });
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
    /**
     * Send the same message to many connections.
     * No matter how many target connections are, the message would be only encoded once.
     * @param msgName 
     * @param msg - Message body
     * @param connIds - `id` of target connections, `undefined` means broadcast to every connections.
     * @returns Send result, `isSucc: true` means the message buffer is sent to kernel, not represents the clients received.
     */
    // async broadcastMsg<T extends string & keyof Conn['ServiceType']['msg']>(msgName: T, msg: Conn['ServiceType']['msg'][T], conns?: Conn[]): Promise<OpResultVoid> {
    //     let connAll = false;
    //     if (!conns) {
    //         conns = this.connections;
    //         connAll = true;
    //     }

    //     const connStr = () => connAll ? '*' : conns!.map(v => v.id).join(',');

    //     if (!conns.length) {
    //         return { isSucc: true };
    //     }

    //     if (this.status !== ServerStatus.Opened) {
    //         this.logger.warn('[BroadcastMsgErr]', `[${msgName}]`, `[To:${connStr()}]`, 'Server not open');
    //         return { isSucc: false, errMsg: 'Server not open' };
    //     }

    //     // GetService
    //     let service = this.serviceMap.msgName2Service[msgName as string];
    //     if (!service) {
    //         this.logger.warn('[BroadcastMsgErr]', `[${msgName}]`, `[To:${connStr()}]`, 'Invalid msg name: ' + msgName);
    //         return { isSucc: false, errMsg: 'Invalid msg name: ' + msgName };
    //     }

    //     // Encode group by dataType
    //     let _opEncodeBuf: EncodeOutput<Uint8Array> | undefined;
    //     let _opEncodeText: EncodeOutput<string> | undefined;
    //     const getOpEncodeBuf = () => {
    //         if (!_opEncodeBuf) {
    //             _opEncodeBuf = TransportDataUtil.encodeServerMsg(this.tsbuffer, service!, msg, 'buffer', 'LONG');
    //         }
    //         return _opEncodeBuf;
    //     }
    //     const getOpEncodeText = () => {
    //         if (!_opEncodeText) {
    //             _opEncodeText = TransportDataUtil.encodeServerMsg(this.tsbuffer, service!, msg, 'text', 'LONG');
    //         }
    //         return _opEncodeText;
    //     }

    //     // 测试一下编码可以通过
    //     let op = conns.some(v => v.dataType === 'buffer') ? getOpEncodeBuf() : getOpEncodeText();
    //     if (!op.isSucc) {
    //         this.logger.warn('[BroadcastMsgErr]', `[${msgName}]`, `[To:${connStr()}]`, op.errMsg);
    //         return op;
    //     }

    //     this.options.logMsg && this.logger.log(`[BroadcastMsg]`, `[${msgName}]`, `[To:${connStr()}]`, msg);

    //     // Batch send
    //     let errMsgs: string[] = [];
    //     return Promise.all(conns.map(async conn => {
    //         // Pre Flow
    //         let pre = await this.flows.preSendMsgFlow.exec({ conn: conn, service: service!, msg: msg }, this.logger);
    //         if (!pre) {
    //             conn.logger.debug('[preSendMsgFlow]', 'Canceled');
    //             return { isSucc: false, errMsg: 'Prevented by preSendMsgFlow' };
    //         }
    //         msg = pre.msg;

    //         // Do send!
    //         let opSend = await conn.sendData((conn.dataType === 'buffer' ? getOpEncodeBuf() : getOpEncodeText())!.output!);
    //         if (!opSend.isSucc) {
    //             return opSend;
    //         }

    //         // Post Flow
    //         this.flows.postSendMsgFlow.exec(pre, this.logger);

    //         return { isSucc: true };
    //     })).then(results => {
    //         for (let i = 0; i < results.length; ++i) {
    //             let op = results[i];
    //             if (!op.isSucc) {
    //                 errMsgs.push(`Conn#conns[i].id: ${op.errMsg}`)
    //             };
    //         }
    //         if (errMsgs.length) {
    //             return { isSucc: false, errMsg: errMsgs.join('\n') }
    //         }
    //         else {
    //             return { isSucc: true }
    //         }
    //     })
    // };

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