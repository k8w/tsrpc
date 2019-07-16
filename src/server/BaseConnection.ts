import { PoolItem } from "../models/Pool";
import { BaseServer, BaseServerOptions } from './BaseServer';
import { BaseServiceType } from '../proto/BaseServiceType';
import { PrefixLogger } from './Logger';

export interface BaseConnectionOptions<ServiceType extends BaseServiceType> {
    server: BaseServer<BaseServerOptions, ServiceType>;
}

export abstract class BaseConnection<ServiceType extends BaseServiceType, OptionsType extends BaseConnectionOptions<ServiceType>> extends PoolItem<OptionsType> {
    abstract logger: PrefixLogger;
    abstract destroy(): void;
}