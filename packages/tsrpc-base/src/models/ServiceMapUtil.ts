import {
  ApiServiceDef,
  MsgServiceDef,
  ServiceProto,
} from '../proto/ServiceProto';

/** A utility for generate `ServiceMap` */
export class ServiceMapUtil {
  static getServiceMap(
    proto: ServiceProto,
    side: 'server' | 'client'
  ): ServiceMap {
    const map: ServiceMap = {
      id2Service: {},
      name2LocalApi: {},
      name2RemoteApi: {},
      name2Msg: {},
    };

    for (const v of proto.services) {
      const match = v.name.match(/(.+\/)?([^\/]+)$/)!;
      const path = match[1] || '';
      const name = match[2];
      if (v.type === 'api') {
        const svc: ApiService = {
          ...v,
          reqSchemaId: `${path}Ptl${name}/Req${name}`,
          resSchemaId: `${path}Ptl${name}/Res${name}`,
        };
        const svcSide = svc.side ?? 'server';
        if (svcSide === 'both' || svcSide === side) {
          map.name2LocalApi[v.name] = svc;
        }
        if (svcSide === 'both' || svcSide !== side) {
          map.name2RemoteApi[v.name] = svc;
        }
        map.id2Service[v.id] = svc;
      } else {
        const svc: MsgService = {
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
  id2Service: { [serviceId: number]: ApiService | MsgService };
  /** API which implemented at local, and called by the remote */
  name2LocalApi: ApiMap;
  /** API which implemented at remote, and called by the local */
  name2RemoteApi: ApiMap;
  name2Msg: { [msgName: string]: MsgService | undefined };
}

export type ApiMap<T extends string = string> = {
  [apiName in T]: ApiService | undefined;
};

export interface ApiService extends ApiServiceDef {
  reqSchemaId: string;
  resSchemaId: string;
}

export interface MsgService extends MsgServiceDef {
  msgSchemaId: string;
}
