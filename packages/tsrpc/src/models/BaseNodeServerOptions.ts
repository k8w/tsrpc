import { BaseServerOptions, defaultBaseServerOptions } from 'tsrpc-base-server';
import { TerminalColorLogger } from '../models/TerminalColorLogger';
import { NodeChalk } from './NodeChalk';

export const defaultBaseNodeServerOptions: BaseNodeServerOptions = {
  ...defaultBaseServerOptions,
  logger: new TerminalColorLogger(),
  chalk: NodeChalk,
  returnInnerError: process.env['NODE_ENV'] !== 'production',
};

export interface BaseNodeServerOptions extends BaseServerOptions {
  /**
   * When uncaught error throwed,
   * whether to return the original error as a property `innerErr`.
   * (May include some sensitive information, suggests set to `false` in production environment.)
   * @defaultValue It depends on environment variable `NODE_ENV`.
   * If `NODE_ENV` equals to `production`, the default value is `false`, otherwise is `true`.
   */
  returnInnerError: boolean;
}
