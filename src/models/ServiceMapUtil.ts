import { ApiServiceDef, MsgServiceDef, ServiceProto } from "tsrpc-proto";

export class ServiceMapUtil {
    static getServiceMap(proto: ServiceProto): ServiceMap {
        let map: ServiceMap = {
            id2Service: {},
            apiName2Service: {},
            msgName2Service: {}
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
                map.apiName2Service[v.name] = svc;
                map.id2Service[v.id] = svc;
            }
            else {
                let svc: MsgService = {
                    ...v,
                    msgSchemaId: `${path}Msg${name}/Msg${name}`,
                };
                map.msgName2Service[v.name] = svc;
                map.id2Service[v.id] = svc;
            }
        }

        return map;
    }
}

export interface ServiceMap {
    id2Service: { [serviceId: number]: ApiService | MsgService },
    apiName2Service: { [apiName: string]: ApiService | undefined },
    msgName2Service: { [msgName: string]: MsgService | undefined }
}

export interface ApiService extends ApiServiceDef {
    reqSchemaId: string,
    resSchemaId: string
}

export interface MsgService extends MsgServiceDef {
    msgSchemaId: string
}