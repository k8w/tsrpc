import { BaseServiceType, ServiceProto } from '@tsrpc/base';
import {
  BaseWebSocketClient,
  BaseWebSocketClientOptions,
  defaultBaseWebSocketClientOptions,
} from '@tsrpc/base-client';
import { defaultBaseNodeClientOptions } from '../models/BaseNodeClientOptions';
import { getClassObjectId } from '../models/getClassObjectId';
import { TSRPC_VERSION } from '../models/version';
import { connectWebSocket } from './models/connectWebSocket';

export class WebSocketClient<
  ServiceType extends BaseServiceType = any
> extends BaseWebSocketClient<ServiceType> {
  declare options: WebSocketClientOptions;

  constructor(
    proto: ServiceProto<ServiceType>,
    options?: Partial<WebSocketClientOptions>
  ) {
    // TODO 检测环境，如果发现非 Node 环境
    // TODO 如果是浏览器环境 提示使用 @tsrpc/browser
    // TODO 如果是小程序环境 提示使用 @tsrpc/miniapp
    // TODO 其它环境 提示去官网

    super(
      proto,
      {
        ...defaultWebSocketClientOptions,
        ...options,
      },
      {
        classObjectId: getClassObjectId(),
        env: {
          tsrpc: TSRPC_VERSION,
          node: process.version,
        },
        connect: connectWebSocket,
      }
    );
  }
}

export const defaultWebSocketClientOptions: BaseWebSocketClientOptions = {
  ...defaultBaseWebSocketClientOptions,
  ...defaultBaseNodeClientOptions,
};

export type WebSocketClientOptions = BaseWebSocketClientOptions;
