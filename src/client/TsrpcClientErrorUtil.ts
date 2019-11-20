import { TsrpcError } from "tsrpc-proto";

export class TsrpcClientErrorUtil {

    static isNetworkError(e: TsrpcError) {
        return e.info && e.info.isNetworkError;
    }

    static isTimeout(e: TsrpcError) {
        return e.info && e.info.code === 'TIMEOUT';
    }

    static isServerOutputError(e: TsrpcError) {
        return e.info && e.info.isServerOutputError;
    }

    static isApiError(e: TsrpcError) {
        return !this.isNetworkError(e) && !(this.isServerOutputError);
    }

}