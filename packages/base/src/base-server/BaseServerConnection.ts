import { BaseConnection, BaseConnectionDataType } from "../base/BaseConnection";
import { TransportData } from "../base/TransportData";
import { Logger } from "../models/Logger";
import { PrefixLogger, PrefixLoggerOptions } from "../models/PrefixLogger";
import { ApiReturn } from "../proto/ApiReturn";
import { BaseServiceType } from "../proto/BaseServiceType";
import { BaseServer } from "./BaseServer";

export abstract class BaseServerConnection<ServiceType extends BaseServiceType = any> extends BaseConnection<ServiceType> {

    public readonly id: number;

    constructor(public readonly server: BaseServer, options: BaseServerConnectionOptions) {
        super(options.dataType, server.options, server.serviceMap, server.tsbuffer, server.localProtoInfo, options.remoteAddress);
        (this.logger as Logger) = new PrefixLogger({
            logger: server.logger,
            prefixs: options.logPrefixs
        });
        this.id = server['_connId'].getNext()

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

}

export interface BaseServerConnectionOptions {
    dataType: BaseConnectionDataType,
    remoteAddress: string,
    logPrefixs: PrefixLoggerOptions['prefixs']
}