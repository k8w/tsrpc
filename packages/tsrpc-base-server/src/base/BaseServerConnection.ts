import { ApiReturn, BaseConnection, BaseConnectionDataType, BaseServiceType, BoxDecoding, OpResultVoid, PrefixLogger, PrefixLoggerOptions, TransportData, TsrpcError, TsrpcErrorType } from "tsrpc-base";
import { BaseServer } from "./BaseServer";
import { BaseServerFlows } from "./BaseServerFlows";

export abstract class BaseServerConnection<ServiceType extends BaseServiceType = any> extends BaseConnection<ServiceType> {

    side: 'server' = 'server';
    declare options: this['server']['options'];

    readonly id: number;
    readonly ip: string;
    // flows: this['server']['flows'];
    declare flows: BaseServerFlows<this>;
    declare logger: PrefixLogger;

    constructor(public readonly server: BaseServer<ServiceType>, privateOptions: PrivateBaseServerConnectionOptions) {
        super(privateOptions.dataType, server.options, {
            flows: server.flows, // as BaseServerFlows<this>
            apiHandlers: server['_apiHandlers'],    // Share apiHandlers with server
            serviceMap: server.serviceMap,
            tsbuffer: server.tsbuffer,
            localProtoInfo: server.localProtoInfo
        });
        this.id = server['_connId'].getNext();
        this.ip = privateOptions.ip;
        this.logger = new PrefixLogger({
            logger: server.logger,
            prefixs: privateOptions.logPrefixs ?? [server.chalk(`[${this.ip}] [Conn#${this.id}]`, ['gray'])]
        });

        // To be override...
        // Init connection (http req/res, ws conn, ...)
    }

    // TODO override _setStatus and logConnect

    /** Close the connection immediately */
    protected override _disconnect(isManual: boolean, reason?: string): void {
        super._disconnect(isManual, reason);
        this.server.connections.delete(this);
        // TODO logConnect
    }

    // Server may disable JSON transport
    protected async _recvBox(box: BoxDecoding, dataType: BaseConnectionDataType): Promise<OpResultVoid> {
        if (dataType === 'text' && !this.server.options.json) {
            if (box.type === 'req') {
                this._sendTransportData({
                    type: 'err',
                    err: new TsrpcError(`The server disabled JSON mode, please use binary instead. (Set 'json: false' at the client)`, { type: TsrpcErrorType.RemoteError }),
                    sn: box.sn,
                    protoInfo: box.protoInfo && this.server.localProtoInfo
                });
            }
            return { isSucc: false, errMsg: `Text input is not allowed when set 'json: false'` }
        }

        return super._recvBox(box, dataType);
    }

    // For server graceful stop
    protected override _recvApiReq(transportData: TransportData & { type: 'req' }): Promise<ApiReturn<any>> {
        const server = this.server;
        ++server['_pendingApiCallNum'];
        let promise = super._recvApiReq(transportData);
        promise.then(() => {
            --server['_pendingApiCallNum'];

            // If all request finsihed, resolve server's graceful stop
            if (server['_rsGracefulStop'] && server['_pendingApiCallNum'] === 0) {
                server['_rsGracefulStop']();
            }
        })
        return promise;
    }

    protected _emitMsg: BaseConnection<ServiceType>['_emitMsg'] = (msgName, msg, msgName2, conn: any) => {
        // Conn listeners first
        this._msgHandlers.emit(msgName, msg, msgName2, conn);
        // Server listeners
        this.server['_msgHandlers'].emit(msgName, msg, msgName2, conn);
    }

}

export interface PrivateBaseServerConnectionOptions {
    dataType: BaseConnectionDataType,
    ip: string,
    logPrefixs?: PrefixLoggerOptions['prefixs'],
}