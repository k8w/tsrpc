import 'colors';
import { Logger } from "tsrpc-proto";

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
        console.debug.call(console, `${this._pid}${this._time()}`.gray, '[DEBUG]'.cyan, ...args);
    }

    log(...args: any[]) {
        console.log.call(console, `${this._pid}${this._time()}`.gray, '[INFO]'.green, ...args);
    }

    warn(...args: any[]) {
        console.warn.call(console, `${this._pid}${this._time()}`.gray, '[WARN]'.yellow, ...args);
    }

    error(...args: any[]) {
        console.error.call(console, `${this._pid}${this._time()}`.gray, '[ERROR]'.red, ...args);
    }

}