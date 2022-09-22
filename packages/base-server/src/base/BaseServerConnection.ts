import { ApiReturn, BaseConnection, BaseConnectionDataType, BaseServiceType, Logger, PrefixLogger, PrefixLoggerOptions, TransportData } from "tsrpc-base";
import { BaseServer } from "./BaseServer";

export abstract class BaseServerConnection<ServiceType extends BaseServiceType = any> extends BaseConnection<ServiceType> {

    declare options: this['server']['options']

    readonly id: number;
    readonly ip: string;
    flows: this['server']['flows'];
    declare logger: PrefixLogger;

    constructor(public readonly server: BaseServer, privateOptions: PrivateBaseServerConnectionOptions) {
        super(privateOptions.dataType, server.options, {
            apiHandlers: server['_apiHandlers'],
            serviceMap: server.serviceMap,
            tsbuffer: server.tsbuffer,
            localProtoInfo: server.localProtoInfo
        });
        this.logger = new PrefixLogger({
            logger: server.logger,
            prefixs: privateOptions.logPrefixs
        });
        this.id = server['_connId'].getNext();
        this.ip = privateOptions.ip;
        this.flows = server.flows;

        // To be override ...
        // Init connection (http req/res, ws conn, ...)
    }

    protected override _disconnect(isManual: boolean, reason?: string): void {
        super._disconnect(isManual, reason);
        this.server.connections.delete(this);
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

    protected _emitMsg: BaseConnection<ServiceType>['_emitMsg'] = (msgName, msg, msgName2, conn) => {
        // TODO
    }

    /** Please use `server.implementApi` instead. */
    declare implementApi: never;

}

export interface PrivateBaseServerConnectionOptions {
    dataType: BaseConnectionDataType,
    ip: string,
    logPrefixs: PrefixLoggerOptions['prefixs'],
}