import { Logger } from "tsrpc-proto";

/**
 * A manager for TSRPC receiving messages
 */
export class MsgHandlerManager {
    private _handlers: { [msgName: string]: Function[] | undefined } = {}

    /**
     * Execute all handlers parallelly
     * @returns handlers count
     */
    forEachHandler(msgName: string, logger: Logger | undefined, ...args: any[]): (any | Promise<any>)[] {
        let handlers = this._handlers[msgName];
        if (!handlers) {
            return [];
        }

        let output: (any | Promise<any>)[] = [];
        for (let handler of handlers) {
            try {
                output.push(handler(...args));
            }
            catch (e) {
                logger?.error('[MsgHandlerError]', e);
            }
        }
        return output;
    }

    /**
     * Add message handler, duplicate handlers to the same `msgName` would be ignored.
     * @param msgName 
     * @param handler 
     * @returns 
     */
    addHandler(msgName: string, handler: Function) {
        let handlers = this._handlers[msgName];
        // 初始化Handlers
        if (!handlers) {
            handlers = this._handlers[msgName] = [];
        }
        // 防止重复监听
        else if (handlers.some(v => v === handler)) {
            return;
        }

        handlers.push(handler);
    }

    /**
     * Remove handler from the specific `msgName`
     * @param msgName 
     * @param handler 
     * @returns 
     */
    removeHandler(msgName: string, handler: Function) {
        let handlers = this._handlers[msgName];
        if (!handlers) {
            return;
        }

        handlers.removeOne(v => v === handler);
    }

    /**
     * Remove all handlers for the specific `msgName`
     * @param msgName 
     */
    removeAllHandlers(msgName: string) {
        this._handlers[msgName] = undefined;
    }
}