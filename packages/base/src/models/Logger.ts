/**
 * An abstract logger interface, which can be used to customize log behaviour.
 * Usually, you can pass `console` for convinience.
 * Or you can write your own implementation, for example, to report to a log system, or hide some log output.
 */
export interface Logger {
    debug(...args: any[]): void;
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const logOrder = ['debug', 'log', 'warn', 'error'] as const;

export function setLogLevel(logger: Logger, logLevel: LogLevel) {
    let level: (typeof logOrder)[number] = logLevel === 'info' ? 'log' : logLevel;
    let order = logOrder.indexOf(level);
    for (let i = 0; i < logOrder.length; ++i) {
        let level = logOrder[i];
        logger[level] = i >= order ? logger[level] : () => { };
    }
}