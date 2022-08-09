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

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const loggerFunNames = ['debug', 'log', 'warn', 'error'] as const;

const emptyFunc = () => { };

export function setLogLevel(logger: Logger, logLevel: LogLevel): Logger {
    const levelIndex = logLevel === 'none' ? 99 : loggerFunNames.indexOf(logLevel === 'info' ? 'log' : logLevel);

    // New logger
    let output: Logger = {} as any;
    loggerFunNames.forEach((v, i) => {
        output[v] = i >= levelIndex ? logger[v].bind(logger) : emptyFunc
    })
    return output
}