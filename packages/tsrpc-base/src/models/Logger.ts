/**
 * An abstract logger interface, which can be used to customize log behaviour.
 * Usually, you can pass `console` for convinience.
 * Or you can write your own implementation, for example, to report to a log system, or hide some log output.
 */
export interface Logger {
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const empty = () => { };

export function setLogLevel(logger: Logger, logLevel: LogLevel): Logger {
    let newLogger: Logger;
    switch (logLevel) {
        case 'none':
            newLogger = { debug: empty, info: empty, warn: empty, error: empty };
        case 'error':
            newLogger = { debug: empty, info: empty, warn: empty, error: logger.error.bind(logger) };
        case 'warn':
            newLogger = { debug: empty, info: empty, warn: logger.warn.bind(logger), error: logger.error.bind(logger) };
        case 'info':
            newLogger = { debug: empty, info: logger.info.bind(logger), warn: logger.warn.bind(logger), error: logger.error.bind(logger) };
        case 'debug':
            newLogger = { debug: logger.debug.bind(logger), info: logger.info.bind(logger), warn: logger.warn.bind(logger), error: logger.error.bind(logger) };;
        default:
            throw new Error(`Invalid logLevel: '${logLevel}'`)
    }
}