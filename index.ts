import 'k8w-extend-native';
import { ServiceProto } from './src/proto/ServiceProto';
import { HttpServer } from './src/server/http/HttpServer';
import { WsServer } from './src/server/ws/WsServer';
import { ApiCall, MsgCall } from './src/server/BaseCall';
import { ApiCallHttp, MsgCallHttp } from './src/server/http/HttpCall';
import { ApiCallWs, MsgCallWs } from './src/server/ws/WsCall';
import { HttpClient } from './src/client/http/HttpClient';

export { ServiceProto as TsrpcServiceProto };
export { HttpServer as TsrpcServer, HttpClient as TsrpcClient };
export { WsServer as TsrpcServerWs };
export { ApiCall, ApiCallHttp, ApiCallWs };
export { MsgCall, MsgCallHttp, MsgCallWs };