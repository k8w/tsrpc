import 'k8w-extend-native';
// Common
export { Logger, TsrpcError } from 'tsrpc-proto';
export { HttpClient, HttpClientOptions } from './client/http/HttpClient';
export { ApiCall } from './server/base/ApiCall';
// Base
export { BaseCall } from './server/base/BaseCall';
export { BaseConnection, BaseConnectionOptions } from './server/base/BaseConnection';
export { ApiHandler, BaseServer, MsgHandler } from './server/base/BaseServer';
export { MsgCall } from './server/base/MsgCall';
export { ApiCallHttp } from './server/http/ApiCallHttp';
// Http
export { HttpConnection, HttpConnectionOptions } from './server/http/HttpConnection';
export { HttpServer, HttpServerOptions } from './server/http/HttpServer';
export { MsgCallHttp } from './server/http/MsgCallHttp';
export { PrefixLogger } from './server/models/PrefixLogger';
export { TerminalColorLogger, TerminalColorLoggerOptions } from './server/models/TerminalColorLogger';
// WebSocket
export { ApiCallWs } from './server/ws/ApiCallWs';
export { MsgCallWs } from './server/ws/MsgCallWs';
export { WsConnection, WsConnectionOptions } from './server/ws/WsConnection';
export { WsServer, WsServerOptions } from './server/ws/WsServer';

export const TSRPC_VERSION = '__TSRPC_VERSION__';