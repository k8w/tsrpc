import { BaseServiceType, ServiceProto } from 'tsrpc-base';
import {
  BaseWebSocketClient,
  BaseWebSocketClientOptions,
  defaultBaseWebSocketClientOptions,
} from 'tsrpc-base-client';
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

export interface WebSocketClientOptions extends BaseWebSocketClientOptions {}
