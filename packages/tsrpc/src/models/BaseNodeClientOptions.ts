import { BaseClientOptions } from 'tsrpc-base-client';
import { TerminalColorLogger } from '../models/TerminalColorLogger';
import { NodeChalk } from './NodeChalk';

export const defaultBaseNodeClientOptions: BaseNodeClientOptions = {
  logger: new TerminalColorLogger(),
  chalk: NodeChalk,
};

export interface BaseNodeClientOptions {
  logger: BaseClientOptions['logger'];
  chalk: BaseClientOptions['chalk'];
}
