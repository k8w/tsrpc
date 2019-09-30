import { TsrpcError } from "tsrpc-proto";

export class TsrpcClientErrorUtil {

    // #region Error Codes
    static TIMEOUT = 'TIMEOUT';
    // #endregion    

    static isNetworkError(e: TsrpcError) {
        return e.info && e.info.isNetworkError;
    }

    static isServerOutputError(e: TsrpcError) {
        return e.info && e.info.isServerOutputError;
    }

    static isApiError(e: TsrpcError) {
        return !this.isNetworkError(e) && !(this.isServerOutputError);
    }

}