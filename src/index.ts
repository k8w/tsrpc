import 'k8w-extend-native';
import packageJson from '../package.json';

export { Logger, TsrpcError } from 'tsrpc-proto';
export { HttpClient } from './client/http/HttpClient';
export { ApiCall, MsgCall } from './server/base/BaseCall';
export { ApiHandler, MsgHandler } from './server/base/BaseServer';
export { ApiCallHttp, MsgCallHttp } from './server/http/HttpCall';
export { ApiHandlerHttp, HttpServer, MsgHandlerHttp } from './server/http/HttpServer';
export { PrefixLogger } from './server/models/PrefixLogger';
export { TerminalColorLogger, TerminalColorLoggerOptions } from './server/models/TerminalColorLogger';
export { ApiCallWs, MsgCallWs } from './server/ws/WsCall';
export { ApiHandlerWs, MsgHandlerWs, WsServer } from './server/ws/WsServer';

export const TSRPC_VERSION = packageJson.version;