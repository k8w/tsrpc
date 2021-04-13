import { Logger, TsrpcError } from "tsrpc-proto";

/**
 * @returns `T` represents succ & continue, `null | undefined` represents break.
 * If error is throwed, `TsrpcError` would be returned to client, `Error` would be converted to "Internal Server Error".
 */
export type FlowNodeReturn<T> = T | null | undefined;
export type FlowNode<T> = (item: T) => FlowNodeReturn<T> | Promise<FlowNodeReturn<T>>;

export class Flow<T> {

    nodes: FlowNode<T>[] = [];

    onError: (e: Error | TsrpcError, last: T, input: T, logger: Logger | undefined) => void = (e, last, input, logger) => {
        logger?.error('Uncaught FlowError:', e);
    };

    async exec(input: T, logger: Logger | undefined): Promise<FlowNodeReturn<T>> {
        let res: ReturnType<FlowNode<T>> = input;

        for (let i = 0; i < this.nodes.length; ++i) {
            try {
                res = await this.nodes[i](res);
            }
            catch (e) {
                this.onError(e, res!, input, logger);
                return undefined;
            }

            // Return 非true 表示不继续后续流程 立即中止
            if (res === null || res === undefined) {
                return res;
            }
        }

        return res;
    }

    push(node: FlowNode<T>): number {
        return this.nodes.push(node);
    }

}
