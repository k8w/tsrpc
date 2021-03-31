import { TsrpcError } from "tsrpc-proto";

/**
 * @returns `T` represents succ & continue, `null | undefined` represents break.
 * If error is throwed, `TsrpcError` would be returned to client, `Error` would be converted to "Internal Server Error".
 */
export type FlowItemReturn<T> = T | null | undefined;
export type FlowItem<T> = (item: T) => FlowItemReturn<T> | Promise<FlowItemReturn<T>>;

export class Flow<T> extends Array<FlowItem<T>> {

    onError?: (e: Error | TsrpcError, lastRes: T, input: T) => void;

    async exec(input: T): Promise<FlowItemReturn<T>> {
        let res: ReturnType<FlowItem<T>> = input;

        for (let i = 0; i < this.length; ++i) {
            try {
                res = await this[i](res);
            }
            catch (e) {
                this.onError?.(e, res!, input);
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
