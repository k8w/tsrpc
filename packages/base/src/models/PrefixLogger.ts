import { Logger } from './Logger';

export interface PrefixLoggerOptions {
  logger: Logger;
  prefixs: (string | (() => string))[];
}

/**
 * Auto add prefix using existed `Logger`
 */
export class PrefixLogger implements Logger {
  readonly logger: PrefixLoggerOptions['logger'];
  readonly prefixs: PrefixLoggerOptions['prefixs'];

  constructor(options: PrefixLoggerOptions) {
    this.logger = options.logger;
    this.prefixs = options.prefixs;
  }

  getPrefix(): string[] {
    return this.prefixs.map((v) => (typeof v === 'string' ? v : v()));
  }

  info(...args: any[]) {
    this.logger.info(...this.getPrefix().concat(args));
  }

  debug(...args: any[]) {
    this.logger.debug(...this.getPrefix().concat(args));
  }

  warn(...args: any[]) {
    this.logger.warn(...this.getPrefix().concat(args));
  }

  error(...args: any[]) {
    this.logger.error(...this.getPrefix().concat(args));
  }
}
