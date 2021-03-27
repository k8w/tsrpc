import { TsrpcError } from "tsrpc-proto";
import { BaseConnection } from "../server/base/BaseConnection";

/**
 * @returns `T` represents succ & continue, `null | undefined` represents break.
 * If error is throwed, `TsrpcError` would be returned to client, `Error` would be converted to "Internal Server Error".
 */
export type FlowExecResult<T> = T | null | undefined;

export type FlowItem<T> = (item: T) => FlowExecResult<T> | Promise<FlowExecResult<T>>;

export class Flow<T> extends Array<FlowItem<T>> {

    async exec(item: T): Promise<FlowExecResult<T>> {
        for (let i = 0; i < this.length; ++i) {
            try {
                let res = this[i](item);
                if (res instanceof Promise) {
                    res = await res;
                }

                // Return 非true 表示不继续后续流程 立即中止
                if (!res) {
                    return { continue: false };
                }
            }
            // 一旦有异常抛出 立即中止处理流程
            catch (e) {
                return { continue: false, err: e };
            }
        }
        return { continue: true };
    }

}
