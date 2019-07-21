import { TSBufferProto } from 'tsbuffer-schema';
import { BaseServiceType } from './BaseServiceType';

export interface BaseServiceDef {
    id: number,
    name: string,
}

export interface ApiServiceDef extends BaseServiceDef {
    type: 'api',
    req: string,
    res: string,
    conf?: { [key: string]: any }
}

export interface MsgServiceDef extends BaseServiceDef {
    type: 'msg',
    msg: string,
    conf?: { [key: string]: any }
}

export type ServiceDef = ApiServiceDef | MsgServiceDef;

export interface ServiceProto {
    services: ServiceDef[],
    types: TSBufferProto
}