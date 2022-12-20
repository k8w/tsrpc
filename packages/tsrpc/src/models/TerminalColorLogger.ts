import chalk from "chalk";
import { Logger } from "tsrpc-base";

export interface TerminalColorLoggerOptions {
    /**
     * Process ID prefix
     * @defaultValue `process.pid`
     */
    pid: string,

    /**
     * `undefined` represents not print time
     * @defaultValue 'yyyy-MM-dd hh:mm:ss'
     */
    timeFormat?: string
}

/**
 * Print log to terminal, with color.
 */
export class TerminalColorLogger implements Logger {

    options: TerminalColorLoggerOptions = {
        pid: process.pid.toString(),
        timeFormat: 'yyyy-MM-dd hh:mm:ss'
    }

    private _pid: string;
    constructor(options?: Partial<TerminalColorLoggerOptions>) {
        Object.assign(this.options, options);
        this._pid = this.options.pid ? `<${this.options.pid}> ` : '';
    }

    private _time(): string {
        return this.options.timeFormat ? new Date().format(this.options.timeFormat) : '';
    }

    debug(...args: any[]) {
        console.debug.call(console, chalk.gray(`${this._pid}${this._time()}`), chalk.cyan('[DEBUG]'), ...args);
    }

    info(...args: any[]) {
        console.info.call(console, chalk.gray(`${this._pid}${this._time()}`), chalk.green('[INFO]'), ...args);
    }

    warn(...args: any[]) {
        console.warn.call(console, chalk.gray(`${this._pid}${this._time()}`), chalk.yellow('[WARN]'), ...args);
    }

    error(...args: any[]) {
        console.error.call(console, chalk.gray(`${this._pid}${this._time()}`), chalk.red('[ERROR]'), ...args);
    }

}