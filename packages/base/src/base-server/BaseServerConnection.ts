import { BaseConnection, BaseConnectionDataType, BaseConnectionOptions, ConnectionStatus } from "../base/BaseConnection";
import { Logger } from "../models/Logger";
import { PrefixLogger } from "../models/PrefixLogger";
import { BaseServiceType } from "../proto/BaseServiceType";
import { BaseServer } from "./BaseServer";

export abstract class BaseServerConnection<ServiceType extends BaseServiceType = any> extends BaseConnection<ServiceType> {

    public readonly id: number;

    constructor(public readonly server: BaseServer, options: BaseServerConnectionOptions) {
        super(options.dataType, server.options, server.serviceMap, server.tsbuffer, server.localProtoInfo, options.remoteAddress);
        this.id = options.id;
        (this.logger as Logger) = options.logger;

        this._setStatus(ConnectionStatus.Connected);
        // TODO push to server.connections
        if (this._status !== ServerStatus.Started) {
            conn['_disconnect'](false, 'Server stopped', 1001);
        }
    }

    protected _disconnect(isManual: boolean, reason?: string, code?: number): void {
        super._disconnect(isManual, reason, code);

        let idx = this.server.connections.binarySearch(this.id, v => v.id);
        if (idx > -1) {
            this.server.connections.splice(idx, 1);
        }
    }

}

export interface BaseServerConnectionOptions {
    dataType: BaseConnectionDataType,
    id: number,
    remoteAddress: string,
    logger: PrefixLogger
}