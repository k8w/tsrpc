import { TSBuffer } from "tsbuffer";
import { BaseConnectionDataType, BaseConnectionOptions, ConnectionStatus, defaultBaseConnectionOptions, PROMISE_ABORTED } from "../base/BaseConnection";
import { BoxBuffer, BoxTextEncoding, TransportData } from "../base/TransportData";
import { TransportDataUtil } from "../base/TransportDataUtil";
import { Chalk } from "../models/Chalk";
import { Counter } from "../models/Counter";
import { getCustomObjectIdTypes } from "../models/getCustomObjectIdTypes";
import { Logger, LogLevel, setLogLevel } from "../models/Logger";
import { OpResultVoid } from "../models/OpResult";
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
                    this._rsGracefulStop = rs;
                    // Mark all conns as disconnecting
                    this.connections.forEach(v => { v['_setStatus'](ConnectionStatus.Disconnecting) });
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

    /**
     * Send the same message to many connections.
     * No matter how many target connections are, the message would be only encoded once.
     * @param msgName 
     * @param msg - Message body
     * @param connIds - `id` of target connections, `undefined` means broadcast to every connections.
     * @returns Send result, `isSucc: true` means the message buffer is sent to kernel, not represents the clients received.
     */
    async broadcastMsg<T extends string & keyof Conn['ServiceType']['msg']>(msgName: T, msg: Conn['ServiceType']['msg'][T], conns?: Conn[]): Promise<OpResultVoid> {
        let isAllConn = false;
        if (!conns) {
            conns = Array.from(this.connections);
            isAllConn = true;
        }

        let _connStr: string | undefined;
        const getConnStr = () => _connStr ?? (_connStr = (isAllConn ? '*' : conns!.map(v => '$' + v.id).join(',')));

        if (!conns.length) {
            return { isSucc: true };
        }

        if (this._status !== ServerStatus.Started) {
            this.logger.error('[BroadcastMsgErr]', `[${msgName}]`, `[To:${getConnStr()}]`, 'Server is not started');
            return { isSucc: false, errMsg: 'Server is not started' };
        }

        // Pre Flow
        let pre = await this.flows.preBroadcastMsgFlow.exec({
            msgName: msgName,
            msg: msg,
            conns: conns
        }, this.logger);
        if (!pre) {
            return PROMISE_ABORTED;
        }
        msgName = pre.msgName as T;
        msg = pre.msg;
        conns = pre.conns;

        // GetService
        let service = this.serviceMap.msgName2Service[msgName as string];
        if (!service) {
            this.logger.error('[BroadcastMsgErr]', `[${msgName}]`, `[To:${getConnStr()}]`, 'Invalid msg name: ' + msgName);
            return { isSucc: false, errMsg: 'Invalid msg name: ' + msgName };
        }

        const transportData: TransportData & { type: 'msg' } = {
            type: 'msg',
            serviceName: msgName,
            body: msg
        }

        // 区分 dataType 不同的 conns
        let connGroups: { conns: Conn[], dataType: BaseConnectionDataType, data: any }[] = conns.groupBy(v => v.dataType).map(v => ({
            conns: v,
            dataType: v.key,
            data: null
        }));

        // Encode
        for (let groupItem of connGroups) {
            // Encode body
            const opEncodeBody = groupItem.dataType === 'buffer'
                ? TransportDataUtil.encodeBodyBuffer(transportData, this.serviceMap, this.tsbuffer, this.options.skipEncodeValidate)
                : TransportDataUtil.encodeBodyText(transportData, this.serviceMap, this.tsbuffer, this.options.skipEncodeValidate, groupItem.conns[0]['_encodeJsonStr']);
            if (!opEncodeBody.isSucc) {
                this.logger.error('[BroadcastMsgErr] Encode msg to text error.\n  |- ' + opEncodeBody.errMsg);
                return { isSucc: false, errMsg: 'Encode msg to text error.\n  |- ' + opEncodeBody.errMsg };
            }

            // Encode box
            const opEncodeBox = groupItem.dataType === 'buffer'
                ? TransportDataUtil.encodeBoxBuffer(opEncodeBody.res as BoxBuffer)
                : (groupItem.conns[0]['_encodeBoxText'] ?? TransportDataUtil.encodeBoxText)(opEncodeBody.res as BoxTextEncoding, groupItem.conns[0]['_encodeSkipSN'])
            if (!opEncodeBox.isSucc) {
                this.logger.error(`[BroadcastMsgErr] Encode ${groupItem.dataType === 'buffer' ? 'BoxBuffer' : 'BoxText'} error.\n  |- ${opEncodeBox.errMsg}`);
                return { isSucc: false, errMsg: `Encode ${groupItem.dataType === 'buffer' ? 'BoxBuffer' : 'BoxText'} error.\n  |- ${opEncodeBox.errMsg}` };
            }
        }

        // SEND
        this.options.logMsg && this.logger.log(`[BroadcastMsg]`, `[${msgName}]`, `[To:${getConnStr()}]`, msg);
        let promiseSends: Promise<OpResultVoid>[] = [];
        connGroups.forEach(v => {
            const data = v.data;
            promiseSends = promiseSends.concat(v.conns.map(v => v['_sendData'](data, transportData)));
        });

        // Batch send
        let errMsgs: string[] = [];
        return Promise.all(promiseSends).then(results => {
            for (let i = 0; i < results.length; ++i) {
                let op = results[i];
                if (!op.isSucc) {
                    errMsgs.push(`Conn$${conns![i].id}: ${op.errMsg}`)
                };
            }
            if (errMsgs.length) {
                return { isSucc: false, errMsg: errMsgs.join('\n') }
            }
            else {
                return { isSucc: true }
            }
        })
    };
}

export const defaultBaseServerOptions: BaseServerOptions = {
    ...defaultBaseConnectionOptions,
    defaultDataType: 'text',
    allowedDataTypes: ['text', 'buffer'],
    strictNullChecks: false,
    logLevel: 'debug'
}

export interface BaseServerOptions extends BaseConnectionOptions {
    /** @defaultValue 'text' */
    defaultDataType: BaseConnectionDataType,
    /** @defaultValue ['text', 'buffer'] */
    allowedDataTypes: BaseConnectionDataType[],

    /** @defaultValue 'debug' */
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