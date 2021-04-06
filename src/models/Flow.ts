import { Logger, TsrpcError } from "tsrpc-proto";

/**
 * @returns `T` represents succ & continue, `null | undefined` represents break.
 * If error is throwed, `TsrpcError` would be returned to client, `Error` would be converted to "Internal Server Error".
 */
export type FlowItemReturn<T> = T | null | undefined;
export type FlowItem<T> = (item: T) => FlowItemReturn<T> | Promise<FlowItemReturn<T>>;

export class Flow<T> extends Array<FlowItem<T>> {

    onError: (e: Error | TsrpcError, last: T, input: T, logger: Logger | undefined) => void = (e, last, input, logger) => {
        logger?.error('Uncaught FlowError:', e);
    };

    async exec(input: T, logger: Logger | undefined): Promise<FlowItemReturn<T>> {
        let res: ReturnType<FlowItem<T>> = input;

        for (let i = 0; i < this.length; ++i) {
            try {
                res = await this[i](res);
            }
            catch (e) {
                this.onError(e, res!, input, logger);
                return undefined;
            }

            // Return 非true 表示不继续后续流程 立即中止
            if (res === null || res === undefined) {
                break;
            }
        }

        return res;
    }

}
