import { TsrpcError } from "tsrpc-proto";
import { BaseServer } from '../server/BaseServer';

export class TsrpcClientErrorUtil {

    static isNetworkError(e: TsrpcError) {
        return e.info && e.info.isNetworkError;
    }

    static isServerError(e: TsrpcError) {
        return e.info && e.info.isServerError;
    }

    static isApiError(e: TsrpcError) {
        return !this.isNetworkError(e) && !(this.isServerError(e));
    }

}