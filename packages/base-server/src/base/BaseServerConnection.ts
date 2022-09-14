import { ApiReturn, BaseConnection, BaseConnectionDataType, BaseServiceType, Logger, PrefixLogger, PrefixLoggerOptions, TransportData } from "tsrpc-base";
import { BaseServer } from "./BaseServer";

export abstract class BaseServerConnection<Server extends BaseServer = any> extends BaseConnection<Server['Conn']['ServiceType']> {

    declare options: Server['options']

    readonly id: number;
    readonly ip: string;
    flows: Server['flows'];

    constructor(public readonly server: Server, privateOptions: PrivateBaseServerConnectionOptions) {
        super(privateOptions.dataType, server.options, {
            apiHandlers: server['_apiHandlers'],
            serviceMap: server.serviceMap,
            tsbuffer: server.tsbuffer,
            localProtoInfo: server.localProtoInfo
        });
        (this.logger as Logger) = new PrefixLogger({
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

    protected _emitMsg: BaseConnection<Server['Conn']['ServiceType']>['_emitMsg'] = (a, b, c, d) => {

    }

    /** Please use `server.implementApi` instead. */
    declare implementApi: never;

}

export interface PrivateBaseServerConnectionOptions {
    dataType: BaseConnectionDataType,
    ip: string,
    logPrefixs: PrefixLoggerOptions['prefixs'],
}