import { ApiReturn, TsrpcError, TsrpcErrorType } from "tsrpc-proto";
import { BaseConnection, BaseServiceType, PrefixLogger } from "../..";
import { BaseConnectionOptions, ConnectionStatus } from "../base/BaseConnection";

export interface InnerConnectionOptions<ServiceType extends BaseServiceType> extends BaseConnectionOptions<ServiceType> {
    rs: (ret: ApiReturn<any>) => void;
}

/**
 * Server can `callApi` it self by using this inner connection
 */
export class InnerConnection<ServiceType extends BaseServiceType = any> extends BaseConnection<ServiceType> {
    readonly type = 'SHORT';
    rs?: (ret: ApiReturn<any>) => void;

    constructor(options: InnerConnectionOptions<ServiceType>) {
        super(options, new PrefixLogger({
            logger: options.server.logger,
            prefixs: [`Inner #${options.id}`]
        }));

        this.rs = options.rs;
    }

    private _status: ConnectionStatus = ConnectionStatus.Opened;
    get status(): ConnectionStatus {
        return this._status;
    }

    close(reason?: string): void {
        this.sendReturn({
            isSucc: false,
            err: new TsrpcError(reason ?? 'Internal Server Error', {
                type: TsrpcErrorType.ServerError,
                code: 'CONN_CLOSED'
            })
        });
    }

    sendReturn(ret: ApiReturn<any>) {
        this.rs?.(ret);
        this.rs = undefined;
        this._status = ConnectionStatus.Closed;
    }

    protected _sendData(): Promise<{ isSucc: true; } | { isSucc: false; errMsg: string; }> {
        throw new Error("Cannot sendData in the InnerConnection.");
    }
}