import { ApiReturn, TsrpcError, TsrpcErrorType } from "tsrpc-proto";
import { ApiCall, BaseConnection, BaseServiceType, PrefixLogger, TransportDataUtil } from "../..";
import { BaseConnectionOptions, ConnectionStatus } from "../base/BaseConnection";
import { ApiCallInner } from "./ApiCallInner";

export interface InnerConnectionOptions<ServiceType extends BaseServiceType> extends BaseConnectionOptions<ServiceType> {
    return: {
        type: 'raw' | 'json',
        rs: (ret: ApiReturn<any>) => void;
    } | {
        type: 'buffer',
        rs: (ret: Uint8Array) => void;
    }
}

/**
 * Server can `callApi` it self by using this inner connection
 */
export class InnerConnection<ServiceType extends BaseServiceType = any> extends BaseConnection<ServiceType> {
    readonly type = 'SHORT';

    protected readonly ApiCallClass = ApiCallInner;
    protected readonly MsgCallClass = null as any;

    return!: InnerConnectionOptions<any>['return'];

    constructor(options: InnerConnectionOptions<ServiceType>) {
        super(options, new PrefixLogger({
            logger: options.server.logger,
            prefixs: [`Inner #${options.id}`]
        }));

        this.return = options.return;
    }

    private _status: ConnectionStatus = ConnectionStatus.Opened;
    get status(): ConnectionStatus {
        return this._status;
    }

    close(reason?: string): void {
        this.doSendData({
            isSucc: false,
            err: new TsrpcError(reason ?? 'Internal Server Error', {
                type: TsrpcErrorType.ServerError,
                code: 'CONN_CLOSED',
                reason: reason
            })
        });
    }

    protected async doSendData(data: Uint8Array | ApiReturn<any>, call?: ApiCall): Promise<{ isSucc: true; } | { isSucc: false; errMsg: string; }> {
        this._status = ConnectionStatus.Closed;

        if (this.return.type === 'buffer') {
            if (!(data instanceof Uint8Array)) {
                // encode tsrpc error
                if (!data.isSucc) {
                    let op = TransportDataUtil.tsbuffer.encode({
                        error: data.err
                    }, 'ServerOutputData');
                    if (op.isSucc) {
                        return this.doSendData(op.buf, call);
                    }
                }
                return { isSucc: false, errMsg: 'Error data type' };
            }
            this.return.rs(data);
            return { isSucc: true }
        }
        else {
            if (data instanceof Uint8Array) {
                return { isSucc: false, errMsg: 'Error data type' };
            }
            this.return.rs(data);
            return { isSucc: true }
        }
    }
}