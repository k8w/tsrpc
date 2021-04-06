export class PromiseUtil {

    static enableAbort<T>(promise: Promise<T>, promiseOptions?: PromiseOptions): Promise<T> & { abort(): void } {
        let isAborted = false;
        let output = new Promise<T>((rs, rj) => {
            promise.then(v => {
                if (!isAborted) {
                    rs(v)
                }
            });
            promise.catch(e => {
                if (!isAborted) {
                    rj(e);
                }
            })
        }) as Promise<T> & { abort(): void };
        output.abort = () => {
            isAborted = true;
            promiseOptions?.onAbort?.();
        };
        return output;
    }

}

export type PromiseOptions = {
    onAbort?: () => void,
    sn?: number
};