import 'k8w-extend-native';
export { ApiCall } from './server/base/ApiCall';
export { MsgCall } from './server/base/MsgCall';
export { MsgCallHttp } from './server/http/MsgCallHttp';
export { Logger, TsrpcError } from 'tsrpc-proto';
export { HttpClient } from './client/http/HttpClient';
export { ApiHandler, MsgHandler } from './server/base/BaseServer';
export { ApiCallHttp } from './server/http/ApiCallHttp';
export { HttpServer,  } from './server/http/HttpServer';
export { PrefixLogger } from './server/models/PrefixLogger';
export { TerminalColorLogger, TerminalColorLoggerOptions } from './server/models/TerminalColorLogger';
export { ApiCallWs, MsgCallWs } from './server/ws/WsCall';
export { ApiHandlerWs, MsgHandlerWs, WsServer } from './server/ws/WsServer';

export const TSRPC_VERSION = '__TSRPC_VERSION__';