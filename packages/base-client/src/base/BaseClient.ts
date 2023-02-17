import {
  ApiHandler,
  ApiHandlerUtil,
  AutoImplementApiReturn,
  BaseConnection,
  BaseConnectionOptions,
  BaseServiceType,
  ConnectionStatus,
  defaultBaseConnectionOptions,
  Flow,
  getCustomObjectIdTypes,
  LocalApiName,
  Logger,
  LogLevel,
  OpResultVoid,
  PROMISE_ABORTED,
  ProtoInfo,
  ServiceMapUtil,
  ServiceProto,
  setLogLevel,
} from '@tsrpc/base';
import { TSBuffer } from 'tsbuffer';
import { BaseClientFlows } from './BaseClientFlows';

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
 * {@link https://github.com/k8w/@tsrpc/browser}
 * {@link https://github.com/k8w/@tsrpc/miniapp}
 */
export abstract class BaseClient<
  ServiceType extends BaseServiceType = any
> extends BaseConnection<ServiceType> {
  side: 'client' = 'client';

  declare readonly options: BaseClientOptions;

  declare flows: BaseClientFlows<this>;

  constructor(
    serviceProto: ServiceProto<ServiceType>,
    options: BaseClientOptions,
    privateOptions: PrivateBaseClientOptions
  ) {
    const serviceMap = ServiceMapUtil.getServiceMap(serviceProto, 'client');
    const tsbuffer = new TSBuffer(
      {
        ...serviceProto.types,
        ...getCustomObjectIdTypes(privateOptions.classObjectId),
      },
      {
        strictNullChecks: options.strictNullChecks,
        skipEncodeValidate: options.skipEncodeValidate,
        skipDecodeValidate: options.skipDecodeValidate,
      }
    );
    options.logger = setLogLevel(options.logger, options.logLevel);

    const flows: BaseClientFlows<this> = {
      postConnectFlow: new Flow(),
      postDisconnectFlow: new Flow(),
      preCallApiFlow: new Flow(),
      preCallApiReturnFlow: new Flow(),
      preApiCallFlow: new Flow(),
      preApiCallReturnFlow: new Flow(),
      postApiCallReturnFlow: new Flow(),
      preRecvMsgFlow: new Flow(),
      preSendMsgFlow: new Flow(),
      postSendMsgFlow: new Flow(),
      preRecvDataFlow: new Flow(),
      preSendDataFlow: new Flow(),
      postSendDataFlow: new Flow(),
      preConnectFlow: new Flow(),
    };

    super(options.json ? 'text' : 'buffer', options, {
      flows: flows,
      serviceMap,
      tsbuffer,
      localProtoInfo: {
        lastModified: serviceProto.lastModified,
        md5: serviceProto.md5,
        ...privateOptions.env,
      },
    });
  }

  protected _errConnNotConnected(): OpResultVoid & { isSucc: false } {
    return {
      isSucc: false,
      errMsg: `The client is not connected, please call 'client.connect()' first.`,
    };
  }

  // TODO base connect
  // Some 不需要连接（如 HTTP IPC），也可以视为自动连接（屏蔽 connect 方法）
  protected _connecting?: Promise<OpResultVoid>;
  /**
   * Start connecting, you must connect first before `callApi()` and `sendMsg()`.
   * @throws never
   */
  async connect(options?: ConnectOptions): Promise<OpResultVoid> {
    // 已连接成功
    if (this.status === ConnectionStatus.Connected) {
      return { isSucc: true };
    }
    // 连接中
    if (this._connecting) {
      return this._connecting;
    }
    if (this.status !== ConnectionStatus.Disconnected) {
      return {
        isSucc: false,
        errMsg: `You can only call "connect" if the ${this.connName} status is "Disconnected" (the current status is "${this.status}")`,
      };
    }
    this.status = ConnectionStatus.Connecting;

    this._connecting = (async () => {
      // Pre Flow
      const pre = await this.flows.preConnectFlow.exec(
        { conn: this },
        this.logger
      );
      // Canceled
      if (!pre) {
        this.status = ConnectionStatus.Disconnected;
        return PROMISE_ABORTED;
      }

      // Connect (Timeout 5000s)
      const op: OpResultVoid = await Promise.race([
        new Promise<OpResultVoid>((rs) => {
          setTimeout(() => {
            rs({
              isSucc: false,
              errMsg: 'Connect to the server failed because of timeout.',
            });
          }, options?.timeout ?? 5000);
        }),
        this._doConnect(this.logger),
      ]);

      if (op.isSucc) {
        this.options.logConnect &&
          this.logger.info('[Connect] Connected to the server successfully');
        this.status = ConnectionStatus.Connected;
        this.flows.postConnectFlow.exec(this, this.logger);
      } else {
        this.logger?.error('[ConnectErr]', op);
        this.status = ConnectionStatus.Disconnected;
      }

      return op;
    })();

    this._connecting
      .catch((e) => {})
      .then(() => {
        this._connecting = undefined;
      });

    return this._connecting;
  }
  // Need log connecting
  protected abstract _doConnect(logger: Logger): Promise<OpResultVoid>;

  /**
   * Register an implementation function for a client-side API.
   * So that when `ApiCall` is receiving, it can be handled correctly.
   * @param apiName
   * @param handler
   */
  implementApi<T extends LocalApiName<this>>(
    apiName: T,
    handler: ApiHandler<this, T>
  ): void {
    return ApiHandlerUtil.implementApi(
      this,
      this._apiHandlers,
      apiName,
      handler
    );
  }

  /**
   * Implement all apis from `apiDir` automatically
   * @param apiDir The same structure with protocols folder, each `PtlXXX.ts` has a corresponding `ApiXXX.ts`
   * @param delay Delay or maxDelayTime(ms), `true` means no maxDelayTime (delay to when the api is called).
   */
  async autoImplementApi(
    apiDir: string,
    delay?: boolean | number
  ): Promise<AutoImplementApiReturn>;
  /**
   * Implement single api or a group of api from `apiDir` automatically
   * You can end with a wildchard `*` to match a group of APIs, like `autoImplementApi('user/*', 'src/api/user')`.
   * @param apiName The name of API to implement.
   * @param apiDir The same structure with protocols folder, each `PtlXXX.ts` has a corresponding `ApiXXX.ts`
   * @param delay Delay or maxDelayTime(ms), `true` means no maxDelayTime (delay to when the api is called).
   */
  async autoImplementApi(
    apiName: string,
    apiDir: string,
    delay?: boolean | number
  ): Promise<AutoImplementApiReturn>;
  async autoImplementApi(
    dirOrName: string,
    dirOrDelay?: string | boolean | number,
    delay?: boolean | number
  ): Promise<AutoImplementApiReturn> {
    return ApiHandlerUtil.autoImplementApi(
      this,
      this._apiHandlers,
      dirOrName,
      dirOrDelay,
      delay
    );
  }

  // #region Deprecated 3.x API
  /** @deprecated Use `onMsg` instead. */
  listenMsg = this.onMsg;
  /** @deprecated Use `offMsg` instead. */
  unlistenMsg = this.offMsg;
  /** @deprecated Use `offMsg` instead. */
  unlistenMsgAll<T extends string & keyof ServiceType['msg']>(
    msgName: T | RegExp
  ) {
    this.offMsg(msgName);
  }
  // #endregion
}

export const defaultBaseClientOptions: BaseClientOptions = {
  ...defaultBaseConnectionOptions,
  json: false,
  logLevel: 'info',
  strictNullChecks: false,
};

export interface BaseClientOptions extends BaseConnectionOptions {
  /**
   * Whether allow JSON transportation.
   * If you want to use JSON, make sure to set `json: true` on both server and client.
   *
   * For security and efficient reason, we recommend to you use binary transportation.
   *
   * @defaultValue `false`
   */
  json: boolean;

  /** @defaultValue 'warn' */
  logLevel: LogLevel;

  // TSBufferOptions
  strictNullChecks: boolean;

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
  classObjectId: { new (id?: any): any };

  env: Pick<ProtoInfo, 'tsrpc' | 'node'>;
}

export interface ConnectOptions {
  /**
   * Timeout to connect (ms)
   * @defaultValue 5000
   */
  timeout: number;
}