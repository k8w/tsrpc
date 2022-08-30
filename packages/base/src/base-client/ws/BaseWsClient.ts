import { ConnectionStatus, PROMISE_ABORTED } from "../../base/BaseConnection";
import { TransportData } from "../../base/TransportData";
import { OpResult } from "../../models/OpResult";
import { TransportOptions } from "../../models/TransportOptions";
import { BaseServiceType } from "../../proto/BaseServiceType";
import { ServiceProto } from "../../proto/ServiceProto";
import { BaseClient, BaseClientOptions, defaultBaseClientOptions, PrivateBaseClientOptions } from "../BaseClient";
import { BaseWsClientTransport } from "./BaseWsClientTransport";

export class BaseWsClient<ServiceType extends BaseServiceType = any> extends BaseClient<ServiceType> {

    declare readonly options: BaseWsClientOptions;
    protected _ws: BaseWsClientTransport;

    constructor(serviceProto: ServiceProto<ServiceType>, options: BaseWsClientOptions, privateOptions: PrivateBaseWsClientOptions) {
        super(serviceProto, options, privateOptions);

        // Init transport
        this._ws = privateOptions.transport;
        this._ws.logger = this.logger;
        this._ws.onOpen = this._onWsOpen;
        this._ws.onClose = this._onWsClose;
        this._ws.onError = this._onWsError;
        this._ws.onMessage = this._onWsMessage;

        this.logger.log(`TSRPC WebSocket Client: ${this.options.server}`);
    }

    private _connecting?: {
        promise: Promise<OpResult<void>>,
        rs: (v: OpResult<void>) => void
    };
    /**
     * Start connecting, you must connect first before `callApi()` and `sendMsg()`.
     * @throws never
     */
    async connect(): Promise<OpResult<void>> {
        // 已连接成功
        if (this.status === ConnectionStatus.Connected) {
            return { isSucc: true, res: undefined };
        }

        // 已连接中
        if (this._connecting) {
            return this._connecting.promise;
        }

        // Pre Flow
        let pre = await this.flows.preConnectFlow.exec({ conn: this }, this.logger);
        // Pre return
        if (pre?.return) {
            return pre.return;
        }
        // Canceled
        if (!pre) {
            return PROMISE_ABORTED;
        }

        // Connect WS
        this._rsDisconnect = undefined;
        try {
            this._ws.connect(this.options.server, [this.options.dataType]);
        }
        catch (e) {
            this.logger?.error(e);
            return { isSucc: false, errMsg: (e as Error).message }
        }

        // Connecting
        this._setStatus(ConnectionStatus.Connecting);
        this.logger?.log(`Start connecting ${this.options.server}...`);
        this._connecting = {} as any;
        let promiseConnect = new Promise<OpResult<void>>(rs => {
            this._connecting!.rs = rs;
        });
        this._connecting!.promise = promiseConnect;

        return promiseConnect;
    }

    private _rsDisconnect?: () => void;
    /**
     * Disconnect immediately
     * @throws never
     */
    async disconnect(reason?: string, code?: number): Promise<void> {
        return new Promise(rs => {
            this._rsDisconnect = rs;
            this._disconnect(true, reason, code);
        })
    }
    protected _disconnect(isManual: boolean, reason?: string, code?: number): void {
        super._disconnect(isManual, reason, code);

        this._ws.close(reason ?? '', code ?? 1000);

        // 连接中，返回连接失败
        if (this._connecting) {
            this.logger.error(`Failed to connect to WebSocket server: ${this.options.server}`);
            this._connecting.rs({
                isSucc: false,
                errMsg: `Failed to connect to WebSocket server: ${this.options.server}`
            });
            this._connecting = undefined;
        }
    }

    protected _onWsOpen = () => {
        if (!this._connecting) {
            return;
        }

        // Resolve this.connect()
        this._setStatus(ConnectionStatus.Connected);
        this._connecting.rs({ isSucc: true, res: undefined });
        this._connecting = undefined;
        this.logger?.log(`Connect to ${this.options.server} successfully`);

        this.flows.postConnectFlow.exec(this, this.logger);
    };

    protected _onWsClose = (code?: number, reason?: string) => {
        // Resolve this.disconnect()
        if (this.status === ConnectionStatus.Disconnected && this._rsDisconnect) {
            this._rsDisconnect();
        }
        this._rsDisconnect = undefined;
        this.logger.debug('Websocket disconnect succ', `code=${code} reason=${reason}`);

        // 连接意外断开
        if (this.status !== ConnectionStatus.Disconnected) {
            this.logger.warn(`Lost connection to ${this.options.server}`, `code=${code} reason=${reason}`);
            this._disconnect(false, reason ?? 'Lost connection to server', code ?? 1001);
        }
    };

    protected _onWsError = (e: unknown) => {
        this.logger.error('[WebSocketError]', e);
        this._disconnect(false, '' + e, 1006);
    };

    protected _onWsMessage = (data: Uint8Array | string) => {
        this._recvData(data);
    };

    protected _sendData(data: string | Uint8Array, transportData: TransportData, options?: TransportOptions): Promise<OpResult<void>> {
        return this._ws.send(data);
    }

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