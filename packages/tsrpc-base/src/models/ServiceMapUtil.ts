import { ApiServiceDef, MsgServiceDef, ServiceProto } from "../proto/ServiceProto";

/** A utility for generate `ServiceMap` */
export class ServiceMapUtil {
    static getServiceMap(proto: ServiceProto, side: 'server' | 'client'): ServiceMap {
        let map: ServiceMap = {
            id2Service: {},
            name2LocalApi: {},
            name2RemoteApi: {},
            name2Msg: {}
        }

        for (let v of proto.services) {
            let match = v.name.match(/(.+\/)?([^\/]+)$/)!;
            let path = match[1] || '';
            let name = match[2];
            if (v.type === 'api') {
                let svc: ApiService = {
                    ...v,
                    reqSchemaId: `${path}Ptl${name}/Req${name}`,
                    resSchemaId: `${path}Ptl${name}/Res${name}`,
                }
                const svcSide = svc.side ?? 'server';
                if (svcSide === 'both' || svcSide === side) {
                    map.name2LocalApi[v.name] = svc;
                }
                if (svcSide === 'both' || svcSide !== side) {
                    map.name2RemoteApi[v.name] = svc;
                }
                map.id2Service[v.id] = svc;
            }
            else {
                let svc: MsgService = {
                    ...v,
                    msgSchemaId: `${path}Msg${name}/Msg${name}`,
                };
                map.name2Msg[v.name] = svc;
                map.id2Service[v.id] = svc;
            }
        }

        return map;
    }
}

export interface ServiceMap {
    id2Service: { [serviceId: number]: ApiService | MsgService },
    /** API which implemented at local, and called by the remote */
    name2LocalApi: ApiMap,
    /** API which implemented at remote, and called by the local */
    name2RemoteApi: ApiMap,
    name2Msg: { [msgName: string]: MsgService | undefined }
}

export type ApiMap<T extends string = string> = { [apiName in T]: ApiService | undefined };

export interface ApiService extends ApiServiceDef {
    reqSchemaId: string,
    resSchemaId: string
}

export interface MsgService extends MsgServiceDef {
    msgSchemaId: string
}