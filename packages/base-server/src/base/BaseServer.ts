import {
  ApiHandler,
  ApiHandlerUtil,
  AutoImplementApiReturn,
  BaseConnection,
  BaseConnectionDataType,
  BaseConnectionOptions,
  BaseServiceType,
  BoxBuffer,
  BoxTextEncoding,
  Chalk,
  Counter,
  defaultBaseConnectionOptions,
  EventEmitter,
  Flow,
  getCustomObjectIdTypes,
  Logger,
  LogLevel,
  MsgHandler,
  MsgHandlerUtil,
  OpResultVoid,
  PROMISE_ABORTED,
  ProtoInfo,
  ServiceMap,
  ServiceMapUtil,
  ServiceProto,
  setLogLevel,
  TransportData,
  TransportDataUtil,
} from '@tsrpc/base';
import { TSBuffer } from 'tsbuffer';
import { BaseServerConnection } from './BaseServerConnection';
import { BaseServerFlows } from './BaseServerFlows';

/**
 * Abstract base class for TSRPC Server.
 * Implement on a transportation protocol (like HTTP WebSocket) by extend it.
 * @typeParam ServiceType - `ServiceType` from generated `proto.ts`
 */
export abstract class BaseServer<
  ServiceType extends BaseServiceType = any,
  Conn extends BaseServerConnection<ServiceType> = BaseServerConnection<ServiceType>
> {
  declare ServiceType: ServiceType;
  declare $Conn: Conn;

  flows: BaseServerFlows<Conn> = {
    postConnectFlow: new Flow(),
    postDisconnectFlow: new Flow(),
    preCallApiFlow: new Flow(),
    preCallApiReturnFlow: new Flow(),
    preApiCallFlow: new Flow(),
    preApiCallReturnFlow: new Flow(),
    postApiCallReturnFlow: new Flow(),
    preSendMsgFlow: new Flow(),
    postSendMsgFlow: new Flow(),
    preRecvMsgFlow: new Flow(),
    preSendDataFlow: new Flow(),
    postSendDataFlow: new Flow(),
    preRecvDataFlow: new Flow(),
  };

  /** { [id: number]: Conn } */
  readonly connections = new Set<Conn>();

  // Options
  readonly logger: Logger;
  readonly chalk: Chalk;
  readonly serviceMap: ServiceMap;
  readonly tsbuffer: TSBuffer;
  readonly localProtoInfo: ProtoInfo;

  protected _status: ServerStatus = ServerStatus.Stopped;
  get status() {
    return this._status;
  }

  constructor(
    public serviceProto: ServiceProto<ServiceType>,
    public options: BaseServerOptions,
    privateOptions: PrivateBaseServerOptions
  ) {
    // serviceProto
    this.tsbuffer = new TSBuffer(
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
    this.serviceMap = ServiceMapUtil.getServiceMap(serviceProto, 'server');
    this.localProtoInfo = {
      lastModified: serviceProto.lastModified,
      md5: serviceProto.md5,
      ...privateOptions.env,
    };

    // logger
    this.logger = setLogLevel(this.options.logger, this.options.logLevel);
    this.chalk = options.chalk;
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this._status !== ServerStatus.Stopped) {
      throw new Error(
        `The server is started already. (status=${this._status})`
      );
    }

    this._status = ServerStatus.Starting;
    let succMsg: string;
    try {
      succMsg = await this._start();
    } catch (e) {
      this._status = ServerStatus.Stopped;
      throw e;
    }
    this._status = ServerStatus.Started;

    this.logger.info(this.chalk('[ServerStart]', ['info']) + ' ' + succMsg);
  }

  /**
   * Listen port, wait connection
   * @throws Throw `Error` if start failed
   * @return Successful message (e.g. "Server started at port 3000")
   */
  protected abstract _start(): Promise<string>;

  protected _connId = new Counter();
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
      this.logger.debug('[GracefulStop] gracefulWaitTime=' + gracefulWaitTime);
      this._status = ServerStatus.Stopping;
      let timeout!: ReturnType<typeof setTimeout>;
      const op = await Promise.race([
        new Promise<'timeout'>((rs) => {
          timeout = setTimeout(() => {
            rs('timeout');
          }, gracefulWaitTime);
        }), // Max wait time
        new Promise<'normal'>((rs) => {
          this._rsGracefulStop = rs.bind(null, 'normal');
        }),
      ]);
      // Clear
      clearTimeout(timeout);
      this.logger.debug(
        `${this.chalk('[GracefulStop]', ['warn'])} ${
          op === 'timeout'
            ? 'Max wait time reached, server would stop forcedly'
            : 'Graceful stopped successfully'
        }`
      );
      this._rsGracefulStop = undefined;
    }

    // Do Stop (immediately)
    this._status = ServerStatus.Stopped;
    this.connections.forEach((conn) => {
      conn['_disconnect'](true, 'Server stopped');
    });
    this.logger.info(`${this.chalk('[ServerStop]', ['info'])} Server stopped`);
    return this._stop();
  }

  /**
   * Stop server immediately
   * (Don't need to set server.status)
   */
  protected abstract _stop(): void;

  // #region API Host

  /** Shared with connections */
  protected _apiHandlers: BaseConnection<ServiceType>['_apiHandlers'] = {};

  /**
   * Register an implementation function for a server-side API.
   * So that when `ApiCall` is receiving, it can be handled correctly.
   * @param apiName
   * @param handler
   */
  implementApi<Api extends string & keyof ServiceType['api']>(
    apiName: Api,
    handler: ApiHandler<any>
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

  // #endregion

  // #region Msg Host

  /** NOT shared with connections.
   * Connection-level listeners would trigger firstly, then the server-level.
   */
  protected _msgHandlers: BaseConnection<ServiceType>['_msgHandlers'] =
    new EventEmitter();

  /**
   * Add a message handler,
   * duplicate handlers to the same `msgName` would be ignored.
   * @param msgName
   * @param handler
   * @returns
   */
  onMsg<
    T extends string & keyof ServiceType['msg'],
    U extends MsgHandler<Conn, T>
  >(msgName: T | RegExp, handler: U, context?: any): U {
    return MsgHandlerUtil.onMsg(
      this,
      this._msgHandlers,
      msgName,
      handler,
      context
    );
  }

  onceMsg<T extends string & keyof ServiceType['msg']>(
    msgName: T,
    handler: MsgHandler<Conn, T>,
    context?: any
  ): MsgHandler<Conn, T> {
    return MsgHandlerUtil.onceMsg(this._msgHandlers, msgName, handler, context);
  }

  /**
   * Remove a message handler
   */
  offMsg<T extends string & keyof ServiceType['msg']>(
    msgName: T | RegExp
  ): void;
  offMsg<T extends string & keyof ServiceType['msg']>(
    msgName: T | RegExp,
    handler: Function,
    context?: any
  ): void;
  offMsg<T extends string & keyof ServiceType['msg']>(
    msgName: T | RegExp,
    handler?: Function,
    context?: any
  ) {
    return MsgHandlerUtil.offMsg(
      this,
      this._msgHandlers,
      msgName,
      handler,
      context
    );
  }

  /**
   * Send the same message to many connections.
   * No matter how many target connections are, the message would be only encoded once.
   * @param msgName
   * @param msg - Message body
   * @param connIds - `id` of target connections, `undefined` means broadcast to every connections.
   * @returns Send result, `isSucc: true` means the message buffer is sent to kernel, not represents the clients received.
   */
  async broadcastMsg<T extends string & keyof ServiceType['msg']>(
    msgName: T,
    msg: ServiceType['msg'][T],
    conns?: Conn[]
  ): Promise<OpResultVoid> {
    let isAllConn = false;
    if (!conns) {
      conns = Array.from(this.connections);
      isAllConn = true;
    }

    let _connStr: string | undefined;
    const getConnStr = () =>
      _connStr ??
      (_connStr = isAllConn ? '*' : conns!.map((v) => '$' + v.id).join(','));

    if (!conns.length) {
      return { isSucc: true };
    }

    if (this._status !== ServerStatus.Started) {
      this.logger.error(
        '[BroadcastMsgErr]',
        `[${msgName}]`,
        `[To:${getConnStr()}]`,
        'Server is not started'
      );
      return { isSucc: false, errMsg: 'Server is not started' };
    }

    // Pre Flow
    const pre = await this.flows.preSendMsgFlow.exec(
      {
        msgName: msgName,
        msg: msg,
        conn: conns[0],
        conns: conns,
      },
      this.logger
    );
    if (!pre) {
      return PROMISE_ABORTED;
    }
    msgName = pre.msgName as T;
    msg = pre.msg as ServiceType['msg'][T];
    conns = pre.conns;

    // GetService
    const service = this.serviceMap.name2Msg[msgName as string];
    if (!service) {
      this.logger.error(
        '[BroadcastMsgErr]',
        `[${msgName}]`,
        `[To:${getConnStr()}]`,
        'Invalid msg name: ' + msgName
      );
      return { isSucc: false, errMsg: 'Invalid msg name: ' + msgName };
    }

    const transportData: TransportData & { type: 'msg' } = {
      type: 'msg',
      serviceName: msgName,
      body: msg,
    };

    // Group conns by dataType (different encode method)
    const connGroups: {
      conns: Conn[];
      dataType: BaseConnectionDataType;
      data: any;
    }[] = conns!
      .groupBy((v) => v.dataType)
      .map((v) => ({
        conns: v,
        dataType: v.key,
        data: null,
      }));

    // Encode
    for (const groupItem of connGroups) {
      // Encode body
      const opEncodeBody =
        groupItem.dataType === 'buffer'
          ? TransportDataUtil.encodeBodyBuffer(
              transportData,
              this.serviceMap,
              this.tsbuffer,
              this.options.skipEncodeValidate
            )
          : TransportDataUtil.encodeBodyText(
              transportData,
              this.serviceMap,
              this.tsbuffer,
              this.options.skipEncodeValidate,
              groupItem.conns[0]['_stringifyBodyJson']
            );
      if (!opEncodeBody.isSucc) {
        this.logger.error(
          '[BroadcastMsgErr] Encode msg to text error.\n  |- ' +
            opEncodeBody.errMsg
        );
        return {
          isSucc: false,
          errMsg: 'Encode msg to text error.\n  |- ' + opEncodeBody.errMsg,
        };
      }

      // Encode box
      const opEncodeBox =
        groupItem.dataType === 'buffer'
          ? TransportDataUtil.encodeBoxBuffer(opEncodeBody.res as BoxBuffer)
          : (
              groupItem.conns[0]['_encodeBoxText'] ??
              TransportDataUtil.encodeBoxText
            )(
              opEncodeBody.res as BoxTextEncoding,
              groupItem.conns[0]['_encodeSkipSN']
            );
      if (!opEncodeBox.isSucc) {
        this.logger.error(
          `[BroadcastMsgErr] Encode ${
            groupItem.dataType === 'buffer' ? 'BoxBuffer' : 'BoxText'
          } error.\n | - ${opEncodeBox.errMsg} `
        );
        return {
          isSucc: false,
          errMsg: `Encode ${
            groupItem.dataType === 'buffer' ? 'BoxBuffer' : 'BoxText'
          } error.\n | - ${opEncodeBox.errMsg} `,
        };
      }

      // Pre SendData Flow (run once only)
      const pre = await this.flows.preSendDataFlow.exec(
        {
          conn: groupItem.conns[0],
          data: opEncodeBox.res,
          transportData: transportData,
          conns: groupItem.conns,
        },
        this.logger
      );
      if (!pre) {
        return PROMISE_ABORTED;
      }

      groupItem.data = opEncodeBox.res;
    }

    // SEND
    this.options.logMsg &&
      this.logger.info(
        `[BroadcastMsg]`,
        `[${msgName}]`,
        `[To:${getConnStr()}]`,
        msg
      );
    let promiseSends: Promise<OpResultVoid>[] = [];
    connGroups.forEach((v) => {
      const data = v.data;
      const promises = v.conns.map((v) => v['_sendData'](data, transportData));

      // Post SendData Flow (run once only)
      Promise.all(promises).then((ops) => {
        const succConns = ops
          .filterIndex((v) => v.isSucc)
          .map((i) => v.conns[i]);
        if (succConns.length) {
          this.flows.postSendDataFlow.exec(
            {
              conn: succConns[0],
              conns: succConns,
              data: data,
              transportData: transportData,
            },
            this.logger
          );
        }
      });

      promiseSends = promiseSends.concat(promises);
    });

    // Merge errMsgs and return
    const errMsgs: string[] = [];
    return Promise.all(promiseSends).then((results) => {
      for (let i = 0; i < results.length; ++i) {
        const op = results[i];
        if (!op.isSucc) {
          errMsgs.push(`Conn$${conns![i].id}: ${op.errMsg} `);
        }
      }
      if (errMsgs.length) {
        return { isSucc: false, errMsg: errMsgs.join('\n') };
      } else {
        return { isSucc: true };
      }
    });
  }
  // #endregion
}

export const defaultBaseServerOptions: BaseServerOptions = {
  ...defaultBaseConnectionOptions,
  json: false,
  strictNullChecks: false,
  logLevel: 'info',
};

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
  json: boolean;

  /** @defaultValue 'debug' */
  logLevel: LogLevel;

  // TSBufferOptions
  strictNullChecks: boolean;

  // #region Deprecated
  /** @deprecated Use `json` instead */
  jsonEnabled?: never;
  /** @deprecated Use `apiCallTimeout` instead */
  apiTimeout?: never;
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
  classObjectId: { new (id?: any): any };

  env: Pick<ProtoInfo, 'tsrpc' | 'node'>;
}
