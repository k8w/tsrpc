import { int } from "tsbuffer-schema";
import { TsrpcErrorData, TsrpcErrorType } from "./TransportData";
import { __assign } from "tslib";

/**
 * A unified Error that returned by TSRPC server or client
 * 
 * @remarks
 * It has many uses, for example:
 * 
 * 1. You can handle business errors and network errors uniformly.
 * 2. In API handle process, `throw new TsrpcError('xxx')` would return the same error to client directly (like `call.error()`),
 * while `throw new Error('XXX')` would return a unified "Server Internal Error".
 */
export class TsrpcError implements TsrpcErrorData {
    static Type = TsrpcErrorType;

    message!: string;
    type!: TsrpcErrorType;
    code?: string | int;
    [key: string]: any;

    constructor(data: TsrpcErrorData);
    /**
     * The `type` is `ApiError` by default
     */
    constructor(message: string, data?: Partial<TsrpcErrorData>);
    constructor(dataOrMessage: TsrpcErrorData | string, data?: Partial<TsrpcErrorData>) {
        if (typeof dataOrMessage === 'string') {
            this.message = dataOrMessage;
            this.type = data?.type ?? TsrpcErrorType.ApiError;
            __assign(this, data);
        }
        else {
            __assign(this, dataOrMessage);
        }
    }

    toString() {
        return `[TSRPC ${this.type}]: ${this.message}`;
    }
}