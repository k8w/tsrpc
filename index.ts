import 'k8w-extend-native';
import { Server } from './src/server/ws/WsServer';
import { ServiceProto } from './src/proto/ServiceProto';
import { WebSocketClient } from './src/client/WsClient';
import { BaseServer } from './src/server/BaseServer';

export { Server as TSRPCServer };
export { WebSocketClient as TSRPCClient };
export { ServiceProto as TSRPCServiceProto };

export { BaseServer }