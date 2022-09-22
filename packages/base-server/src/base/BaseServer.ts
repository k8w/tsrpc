import { TSBuffer } from "tsbuffer";
import { BaseConnection, BaseConnectionDataType, BaseConnectionOptions, BoxBuffer, BoxTextEncoding, Chalk, ConnectionStatus, Counter, defaultBaseConnectionOptions, EventEmitter, getCustomObjectIdTypes, Logger, LogLevel, OpResultVoid, PROMISE_ABORTED, ProtoInfo, ServiceMap, ServiceMapUtil, ServiceProto, setLogLevel, TransportData, TransportDataUtil } from "tsrpc-base";
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
    get status() { return this._status };

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
     * Start the server
     */
    async start(): Promise<void> {
        if (this._status !== ServerStatus.Stopped) {
            throw new Error(`The server is started already. (status=${this._status})`)
        }

        this._status = ServerStatus.Starting;
        try {
            await this._start();
        }
        catch (e) {
            this._status = ServerStatus.Stopped;
            throw e;
        }
        this._status = ServerStatus.Started;
    }

    /**
     * Listen port, wait connection, and call this.onConnection()
     * @throws Throw `Error` if start failed
     */
    protected abstract _start(): Promise<void>;

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
     * @returns Promise<void>
     * @throws Throw `Error` if stop failed
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

        // Pre Broadcast Flow
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
                : TransportDataUtil.encodeBodyText(transportData, this.serviceMap, this.tsbuffer, this.options.skipEncodeValidate, groupItem.conns[0]['_stringifyBodyJson']);
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

            // Pre SendData Flow (run once only)
            const pre = await this.flows.preSendDataFlow.exec({
                conn: groupItem.conns[0],
                data: opEncodeBox.res,
                transportData: transportData,
                conns: groupItem.conns
            }, this.logger);
            if (!pre) {
                return PROMISE_ABORTED;
            }

            groupItem.data = opEncodeBox.res;
        }

        // SEND
        this.options.logMsg && this.logger.log(`[BroadcastMsg]`, `[${msgName}]`, `[To:${getConnStr()}]`, msg);
        let promiseSends: Promise<OpResultVoid>[] = [];
        connGroups.forEach(v => {
            const data = v.data;
            let promises = v.conns.map(v => v['_sendData'](data, transportData));

            // Post SendData Flow (run once only)
            Promise.all(promises).then(ops => {
                let succConns = ops.filterIndex(v => v.isSucc).map(i => v.conns[i]);
                if (succConns.length) {
                    this.flows.postSendDataFlow.exec({
                        conn: succConns[0],
                        conns: succConns,
                        data: data,
                        transportData: transportData
                    }, this.logger)
                }
            })

            promiseSends = promiseSends.concat(promises);
        });

        // Merge errMsgs and return
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

    // TODO
    protected _apiHandlers: BaseConnection<Conn['ServiceType']>['_apiHandlers'] = {};
    implementApi() { }
    autoImplementApi() { }

    // TODO
    protected _msgListeners: BaseConnection<Conn['ServiceType']>['_msgListeners'] = new EventEmitter();
    onMsg() { }
    onceMsg() { }
    offMsg() { }
}

export const defaultBaseServerOptions: BaseServerOptions = {
    ...defaultBaseConnectionOptions,
    json: false,
    strictNullChecks: false,
    logLevel: 'debug'
}

export interface BaseServerOptions extends BaseConnectionOptions {
    /**
     * Whether allow JSON transportation.
     * If you want to use JSON, make sure to set `json: true` on both server and client.
     * 
     * Binary transportation is always enabled. 
     * For security and efficient reason, we recommend to you use binary transportation.
     * 
     * @defaultValue `false`
     */
    json: boolean,

    /** @defaultValue 'debug' */
    logLevel: LogLevel,

    // TSBufferOptions
    strictNullChecks: boolean,

    // #region Deprecated
    /** @deprecated Use `json` instead */
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