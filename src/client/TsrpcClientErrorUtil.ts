import { TsrpcError } from "tsrpc-proto";
import { BaseServer } from '../server/BaseServer';

export class TsrpcClientErrorUtil {

    static isNetworkError(e: TsrpcError) {
        return e.info && e.info.isNetworkError;
    }

    static isServerError(e: TsrpcError) {
        return e.info && (e.info.code === 'SERVER_TIMEOUT' || e.info.code === BaseServer.INTERNAL_ERR_INFO || e.info.isServerOutputError);
    }

    static isApiError(e: TsrpcError) {
        return !this.isNetworkError(e) && !(this.isServerError(e));
    }

}