import {
  BaseServiceType,
  Logger,
  OpResultVoid,
  ServiceProto,
  TransportData,
  TransportOptions,
} from 'tsrpc-base';
import {
  BaseClient,
  BaseClientOptions,
  defaultBaseClientOptions,
  PrivateBaseClientOptions,
} from '../base/BaseClient';
import { WebSocketConnect, WebSocketConnectReturn } from './WebSocketConnect';

export class BaseWebSocketClient<
  ServiceType extends BaseServiceType = any
> extends BaseClient<ServiceType> {
  declare readonly options: BaseWebSocketClientOptions;
  protected _connect: WebSocketConnect;
  protected _ws?: WebSocketConnectReturn;

  constructor(
    serviceProto: ServiceProto<ServiceType>,
    options: BaseWebSocketClientOptions,
    privateOptions: PrivateBaseWebSocketClientOptions
  ) {
    super(serviceProto, options, privateOptions);
    this._connect = privateOptions.connect;
    this.logger.info(`TSRPC WebSocket Client: ${this.options.server}`);
  }

  protected _doConnect(logger: Logger): Promise<OpResultVoid> {
    this.options.logConnect &&
      logger.info(
        `${this.chalk('[Connect]', ['info'])}Start connecting to server "${
          this.options.server
        }"...`
      );

    return new Promise((rs) => {
      try {
        this._ws = this._connect({
          server: this.options.server,
          protocols: [this.dataType],
          onOpen: () => {
            rs({ isSucc: true });
          },
          onClose: this._onWsClose,
          onError: this._onWsError,
          onMessage: this._onWsMessage,
        });
      } catch (e) {
        this._ws = undefined;
        rs({ isSucc: false, errMsg: (e as Error).message });
      }
    });
  }

  protected _rsDisconnect?: (res: OpResultVoid) => void;
  protected _doDisconnect(
    isManual: boolean,
    reason?: string
  ): Promise<OpResultVoid> {
    return new Promise<OpResultVoid>((rs) => {
      if (this._ws) {
        try {
          this._rsDisconnect = rs;
          this._ws.close(reason ?? '', isManual ? 1000 : 1001);
        } catch (e) {
          rs({ isSucc: false, errMsg: (e as Error).message });
        }
      }
    }).then((res) => {
      this._rsDisconnect = undefined;
      return res;
    });
  }

  protected _onWsClose = (code?: number, reason?: string) => {
    this.logger.debug(
      'Websocket onclose triggered',
      `server=${this.options.server} code=${code} reason=${reason}`
    );
    this._ws = undefined;

    // 连接意外断开
    if (!this._disconnecting) {
      this._disconnect(false, reason ?? 'Lost connection to server');
    } else {
      this._rsDisconnect?.({ isSucc: true });
    }
  };

  protected _onWsError = (e: unknown) => {
    this.logger.error('[WebSocketError]', e);
    this._disconnect(false, '' + e);
  };

  protected _onWsMessage = (data: Uint8Array | string) => {
    this._recvData(data);
  };

  protected override _sendData(
    data: string | Uint8Array,
    transportData: TransportData,
    options?: TransportOptions
  ): Promise<OpResultVoid> {
    return this._ws!.send(data);
  }
}

export const defaultBaseWebSocketClientOptions: BaseWebSocketClientOptions = {
  ...defaultBaseClientOptions,
  server: 'ws://localhost:3000',
};

export interface BaseWebSocketClientOptions extends BaseClientOptions {
  /** Server URL, starts with `ws://` or `wss://`. */
  server: string;
}

export interface PrivateBaseWebSocketClientOptions
  extends PrivateBaseClientOptions {
  connect: WebSocketConnect;
}
