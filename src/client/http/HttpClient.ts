import { ServiceProto } from "../../proto/ServiceProto";
import { BaseServiceType } from "../../proto/BaseServiceType";
import { CallApiOptions } from "../models/CallApiOptions";
import { ServiceMapUtil, ServiceMap } from '../../models/ServiceMapUtil';
import { TSBuffer } from "tsbuffer";
import { TransportDataUtil } from '../../models/TransportDataUtil';
import * as http from "http";

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
        // GetService
        let service = this.serviceMap.apiName2Service[apiName as string];
        if (!service) {
            throw new Error('Invalid api name: ' + apiName);
        }

        // Encode
        let buf = TransportDataUtil.encodeApiReq(this.tsbuffer, service, req);

        return new Promise<ServiceType['res'][T]>((rs, rj) => {
            let req = http.request(this._options.server, {
                method: 'POST',
                timeout: options && options.timeout || this._options.apiTimeout
            }, res => {
                res.on('data', v => {
                    let parsed = TransportDataUtil.parseServerOutout(this.tsbuffer, this.serviceMap, v);
                    if (parsed.type !== 'api') {
                        rj(new Error('Invalid response'))
                        return;
                    }
                    parsed.isSucc ? rs(parsed.res) : rj(parsed.error);
                })
            });
            req.write(Buffer.from(buf));
            req.end();
        });
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

