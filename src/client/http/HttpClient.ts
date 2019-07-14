import { ServiceProto } from "../../proto/ServiceProto";
import { BaseServiceType } from "../../proto/BaseServiceType";
import { CallApiOptions } from "../models/CallApiOptions";
import { ServiceMapUtil, ServiceMap } from '../../models/ServiceMapUtil';
import { TSBuffer } from "tsbuffer";

export class HttpClient<ServiceType extends BaseServiceType = any> {

    private _options: HttpClientOptions;
    serviceMap: ServiceMap;
    tsbuffer: TSBuffer;

    constructor(options?: Partial<HttpClientOptions>) {
        this._options = Object.assign({}, defaultHttpClientOptions, options);
        this.serviceMap = ServiceMapUtil.getServiceMap(this._options.proto);
        this.tsbuffer = new TSBuffer(this._options.proto.types);
    }

    async callApi<T extends keyof ServiceType['req']>(apiName: T, req: ServiceType['req'][T], options: CallApiOptions = {}): Promise<ServiceType['res'][T]> {
        // // GetService
        // let service = this.serviceMap.apiName2Service[apiName as string];
        // if (!service) {
        //     throw new Error('Invalid api name: ' + apiName);
        // }

        // // Encode
        // let buf = this._tsbuffer.encode(req, service.req);

        // // Transport Encode
        // let sn = this._apiReqSnCounter.getNext();

        // return new Promise<ServiceType['res'][T]>((rs, rj) => {


        //     // Send Data
        //     this._sendTransportData(service.id, buf, sn);
        // })
    }

    async sendMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T]): Promise<void> {
        throw new Error('TODO')
    }

}

const defaultHttpClientOptions: HttpClientOptions = {
    server: '',
    proto: { services: [], types: {} },
    apiTimeout: 3000
}

export interface HttpClientOptions {
    server: string;
    proto: ServiceProto;
    /** API超时时间（毫秒） */
    apiTimeout: number;
}

