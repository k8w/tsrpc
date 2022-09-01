import { BaseConnection, BaseConnectionDataType, ConnectionStatus } from "../base/BaseConnection";
import { Logger } from "../models/Logger";
import { PrefixLogger, PrefixLoggerOptions } from "../models/PrefixLogger";
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

    protected _disconnect(isManual: boolean, reason?: string, code?: number): void {
        super._disconnect(isManual, reason, code);
        this.server.connections.delete(this);
    }

}

export interface BaseServerConnectionOptions {
    dataType: BaseConnectionDataType,
    remoteAddress: string,
    logPrefixs: PrefixLoggerOptions['prefixs']
}