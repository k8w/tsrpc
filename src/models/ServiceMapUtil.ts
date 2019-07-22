import { ServiceProto, ServiceDef, ApiServiceDef, MsgServiceDef } from "tsrpc-proto";

export class ServiceMapUtil {
    static getServiceMap(proto: ServiceProto): ServiceMap {
        let map: ServiceMap = {
            id2Service: {},
            apiName2Service: {},
            msgName2Service: {}
        }

        for (let v of proto.services) {
            map.id2Service[v.id] = v;
            if (v.type === 'api') {
                map.apiName2Service[v.name] = v;
            }
            else {
                map.msgName2Service[v.name] = v;
            }
        }

        return map;
    }
}

export interface ServiceMap {
    id2Service: { [serviceId: number]: ServiceDef },
    apiName2Service: { [apiName: string]: ApiServiceDef | undefined },
    msgName2Service: { [msgName: string]: MsgServiceDef | undefined }
}