import { TsrpcError } from "../proto/TsrpcError";
import { Logger } from "./Logger";

/**
 * @returns 
 * `T` represents succ & continue,
 * `null | undefined` represents interrupt.
 * If error is throwed, `Flow.onError` would be called.
 */
export type FlowNodeReturn<T> = T | null | undefined;
export type FlowNode<T> = <U extends T>(item: U) => FlowNodeReturn<T> | Promise<FlowNodeReturn<T>>;

/**
 * A `Flow` is consists of many `FlowNode`, which is function with the same input and output (like pipeline).
 * 
 * @remarks
 * `Flow` is like a hook or event, executed at a specific time.
 * The difference to event is it can be used to **interrupt** an action, by return `undefined` or `null` in a node.
 */
export class Flow<T> {
    /**
     * All node functions, if you want to adjust the sort you can modify this.
     */
    nodes: FlowNode<T>[] = [];

    /**
     * Event when error throwed from a `FlowNode` function.
     * By default, it does nothing except print a `Uncaught FlowError` error log.
     * @param e 
     * @param last 
     * @param input 
     * @param logger 
     */
    onError: <U extends T>(e: Error | TsrpcError, last: U, input: U, logger: Logger | undefined) => void = (e, last, input, logger) => {
        logger?.error('Uncaught FlowError:', e);
    };

    /**
     * Execute all node function one by one, the previous output is the next input,
     * until the last output would be return to the caller.
     * 
     * @remarks
     * If any node function return `null | undefined`, or throws an error,
     * the latter node functions would not be executed.
     * And it would return `null | undefined` immediately to the caller,
     * which tell the caller it means a interruption,
     * to let the caller stop latter behaviours.
     * 
     * @param input The input of the first `FlowNode`
     * @param logger Logger to print log, `undefined` means to hide all log.
     * @returns 
     */
    async exec<U extends T>(input: U, logger: Logger | undefined): Promise<FlowNodeReturn<T>> {
        let res: ReturnType<FlowNode<T>> = input;

        for (let i = 0; i < this.nodes.length; ++i) {
            try {
                res = await this.nodes[i](res);
            }
            catch (e) {
                this.onError(e as Error, res!, input!, logger);
                return undefined;
            }

            // Return 非true 表示不继续后续流程 立即中止
            if (res === null || res === undefined) {
                return res;
            }
        }

        return res;
    }

    /**
     * Append a node function to the last
     * @param node 
     * @returns 
     */
    push<U extends T>(node: FlowNode<U>): FlowNode<U> {
        this.nodes.push(node);
        return node;
    }

    /**
     * Remove a node function
     * @param node 
     * @returns 
     */
    remove<U extends T>(node: FlowNode<U>) {
        return this.nodes.remove(v => v === node);
    }

    removeAll() {
        this.nodes = [];
    }

}

export type FlowData<T extends Flow<any>> = T extends Flow<infer R> ? R : unknown;