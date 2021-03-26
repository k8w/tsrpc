import 'k8w-extend-native';
import { HttpServer, ApiHandlerHttp, MsgHandlerHttp } from './server/http/HttpServer';
import { WsServer, ApiHandlerWs, MsgHandlerWs } from './server/ws/WsServer';
import { ApiCall, MsgCall } from './server/BaseCall';
import { ApiCallHttp, MsgCallHttp } from './server/http/HttpCall';
import { ApiCallWs, MsgCallWs } from './server/ws/WsCall';
import { HttpClient } from './client/http/HttpClient';
import { ApiHandler, MsgHandler, consoleColorLogger } from './server/BaseServer';
import { PrefixLogger } from './server/PrefixLogger';
import { tsrpcVersion } from '../tsrpcVersion';
import { Logger, TsrpcError } from 'tsrpc-proto';

export { HttpServer as TsrpcServer, HttpClient as TsrpcClient };
export { WsServer as TsrpcServerWs };
export { ApiCall, ApiCallHttp, ApiCallWs };
export { MsgCall, MsgCallHttp, MsgCallWs };
export { ApiHandler, ApiHandlerHttp, ApiHandlerWs };
export { MsgHandler, MsgHandlerHttp, MsgHandlerWs };

export { TsrpcError };

export { consoleColorLogger, PrefixLogger, Logger };

export { tsrpcVersion };