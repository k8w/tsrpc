import { TransportData } from "../../base/TransportData";
import { OpResult } from "../../models/OpResult";
import { TransportOptions } from "../../models/TransportOptions";
import { BaseServiceType } from "../../proto/BaseServiceType";
import { ServiceProto } from "../../proto/ServiceProto";
import { BaseClient, BaseClientOptions, defaultBaseClientOptions, PrivateBaseClientOptions } from "../BaseClient";
import { BaseWsClientFlows } from "./BaseWsClientFlows";
import { BaseWsClientTransport } from "./BaseWsClientTransport";

export class BaseWsClient<ServiceType extends BaseServiceType = any> extends BaseClient<ServiceType> {

    declare readonly options: BaseWsClientOptions;
    declare flows: BaseWsClientFlows<this>;
    protected _ws: BaseWsClientTransport;

    constructor(serviceProto: ServiceProto<ServiceType>, options: BaseWsClientOptions, privateOptions: PrivateBaseWsClientOptions) {
        super(serviceProto, options, privateOptions);

        // Init transport
        this._ws = privateOptions.transport;
        // this._ws.logger = this.logger;
        // this._ws.onOpen = this._onWsOpen;
        // this._ws.onClose = this._onWsClose;
        // this._ws.onError = this._onWsError;
        // this._ws.onMessage = this._onWsMessage;

        this.logger.log(`TSRPC WebSocket Client: ${this.options.server}`);
    }

    // private _connecting?: {
    //     promise: Promise<OpResult<void>>,
    //     rs: (v: OpResult<void>) => void
    // };
    // /**
    //  * Start connecting, you must connect first before `callApi()` and `sendMsg()`.
    //  * @throws never
    //  */
    // async connect(): Promise<{ isSucc: true, errMsg?: undefined } | { isSucc: false, errMsg: string }> {
    //     // 已连接成功
    //     if (this._status === ConnectionStatus.Connected) {
    //         return { isSucc: true };
    //     }

    //     // 已连接中
    //     if (this._connecting) {
    //         return this._connecting.promise;
    //     }

    //     // Pre Flow
    //     let pre = await this.flows.preConnectFlow.exec({}, this.logger);
    //     // Pre return
    //     if (pre?.return) {
    //         return pre.return;
    //     }
    //     // Canceled
    //     if (!pre) {
    //         return new Promise(rs => { });
    //     }

    //     try {
    //         this._wsp.connect(this.options.server, [this.options.json ? 'text' : 'buffer']);
    //     }
    //     catch (e) {
    //         this.logger?.error(e);
    //         return { isSucc: false, errMsg: (e as Error).message }
    //     }
    //     this._status = WsClientStatus.Opening;
    //     this.logger?.log(`Start connecting ${this.options.server}...`);

    //     this._connecting = {} as any;
    //     let promiseConnect = new Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>(rs => {
    //         this._connecting!.rs = rs;
    //     });
    //     this._connecting!.promise = promiseConnect;

    //     return promiseConnect;
    // }

    // private _rsDisconnecting?: () => void;
    // /**
    //  * Disconnect immediately
    //  * @throws never
    //  */
    // async disconnect(code?: number, reason?: string) {
    //     if (this._status === WsClientStatus.Closed) {
    //         return;
    //     }

    //     this._status = WsClientStatus.Closing;
    //     this.logger?.log('Start disconnecting...');
    //     return new Promise<void>(rs => {
    //         this._rsDisconnecting = rs;
    //         // 兼容 Cocos Creator 的原生实现
    //         if (code === undefined && reason === undefined) {
    //             this._wsp.close();
    //         }
    //         else if (reason === undefined) {
    //             this._wsp.close(code);
    //         }
    //         else {
    //             this._wsp.close(code, reason);
    //         }
    //     })
    // }

    // protected _onWsOpen = () => {
    //     if (!this._connecting) {
    //         return;
    //     }

    //     this._status = WsClientStatus.Opened;
    //     this._connecting.rs({ isSucc: true });
    //     this._connecting = undefined;
    //     this.logger?.log('WebSocket connection to server successful');

    //     this.flows.postConnectFlow.exec({}, this.logger);

    //     // First heartbeat
    //     if (this.options.heartbeat) {
    //         this._heartbeat();
    //     }
    // };

    // protected _onWsClose = (code: number, reason: string) => {
    //     let isManual = !!this._rsDisconnecting;
    //     let isConnectedBefore = this.isConnected || isManual;
    //     this._status = WsClientStatus.Closed;

    //     // 连接中，返回连接失败
    //     if (this._connecting) {
    //         this._connecting.rs({
    //             isSucc: false,
    //             errMsg: `Failed to connect to WebSocket server: ${this.options.server}`
    //         });
    //         this._connecting = undefined;
    //         this.logger?.error(`Failed to connect to WebSocket server: ${this.options.server}`);
    //     }

    //     // Clear heartbeat
    //     if (this._pendingHeartbeat) {
    //         clearTimeout(this._pendingHeartbeat.timeoutTimer);
    //         this._pendingHeartbeat = undefined;
    //     }
    //     if (this._nextHeartbeatTimer) {
    //         clearTimeout(this._nextHeartbeatTimer);
    //     }

    //     // disconnect中，返回成功
    //     if (this._rsDisconnecting) {
    //         this._rsDisconnecting();
    //         this._rsDisconnecting = undefined;
    //         this.logger?.log('Disconnected succ', `code=${code} reason=${reason}`);
    //     }
    //     // 非 disconnect 中，从连接中意外断开
    //     else if (isConnectedBefore) {
    //         this.logger?.log(`Lost connection to ${this.options.server}`, `code=${code} reason=${reason}`);
    //     }

    //     // postDisconnectFlow，仅从连接状态断开时触发
    //     if (isConnectedBefore) {
    //         this.flows.postDisconnectFlow.exec({
    //             reason: reason,
    //             isManual: isManual
    //         }, this.logger);
    //     }

    //     // 对所有请求中的 API 报错
    //     this._pendingApis.slice().forEach(v => {
    //         v.onReturn?.({
    //             isSucc: false,
    //             err: new TsrpcError(reason || 'Lost connection to server', { type: TsrpcErrorType.NetworkError, code: 'LOST_CONN' })
    //         })
    //     })
    // };

    // protected _onWsError = (e: unknown) => {
    //     this.logger?.error('[WebSocket Error]', e);

    //     // 连接中，返回连接失败
    //     if (this._connecting) {
    //         this._connecting.rs({
    //             isSucc: false,
    //             errMsg: `Failed to connect to WebSocket server: ${this.options.server}`
    //         });
    //         this._connecting = undefined;
    //         this.logger?.error(`Failed to connect to WebSocket server: ${this.options.server}`);
    //     }
    // };

    // protected _onWsMessage = (data: Uint8Array | string) => {
    //     // 心跳包回包
    //     if (data instanceof Uint8Array && data.length === TransportDataUtil.HeartbeatPacket.length && data.every((v, i) => v === TransportDataUtil.HeartbeatPacket[i])) {
    //         this._onHeartbeatAnswer(data);
    //         return;
    //     }

    //     this._onRecvData(data);
    // };

    protected _sendData(data: string | Uint8Array, transportData: TransportData, options?: TransportOptions): Promise<OpResult<void>> {
        throw new Error("Method not implemented.");
    }

    // #region Deprecated 3.x APIs

    // #endregion

}

export const defaultBaseWsClientOptions: BaseWsClientOptions = {
    ...defaultBaseClientOptions,
    server: 'ws://localhost:3000',
}

export interface BaseWsClientOptions extends BaseClientOptions {
    /** Server URL, starts with `ws://` or `wss://`. */
    server: string;
}

export interface PrivateBaseWsClientOptions extends PrivateBaseClientOptions {
    transport: BaseWsClientTransport
}