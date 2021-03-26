import 'colors';
import { Logger } from "tsrpc-proto";

let pid = process.pid.toString(16);
export class ConsoleColorLogger implements Logger {

    debug(...args: any[]) {
        console.debug.call(console, `<${pid}> ${new Date().format()}`.gray, '[DEBUG]'.cyan, ...args);
    }

    log(...args: any[]) {
        console.log.call(console, `<${pid}> ${new Date().format()}`.gray, '[INFO]'.green, ...args);
    }

    warn(...args: any[]) {
        console.warn.call(console, `<${pid}> ${new Date().format()}`.gray, '[WARN]'.yellow, ...args);
    }

    error(...args: any[]) {
        console.error.call(console, `<${pid}> ${new Date().format()}`.gray, '[ERROR]'.red, ...args);
    }

}