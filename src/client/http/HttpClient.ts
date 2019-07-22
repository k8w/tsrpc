import { BaseServiceType, ServiceProto, TsrpcError } from "tsrpc-proto";
import { ServiceMapUtil, ServiceMap } from '../../models/ServiceMapUtil';
import { TSBuffer } from "tsbuffer";
import { TransportDataUtil } from '../../models/TransportDataUtil';
import * as http from "http";
import { Counter } from '../../models/Counter';
import { Logger } from '../../server/Logger';
import { TransportOptions } from "../models/TransportOptions";
import SuperPromise from 'k8w-super-promise';

export class HttpClient<ServiceType extends BaseServiceType = any> {

    private _options: HttpClientOptions<ServiceType>;
    serviceMap: ServiceMap;
    tsbuffer: TSBuffer;
    logger: Logger;

    private _apiSnCounter = new Counter(1);

    constructor(options?: Partial<HttpClientOptions<ServiceType>>) {
        this._options = Object.assign({}, defaultHttpClientOptions, options);
        this.serviceMap = ServiceMapUtil.getServiceMap(this._options.proto);
        this.tsbuffer = new TSBuffer(this._options.proto.types);
        this.logger = this._options.logger;

        this.logger.log('TSRPC HTTP Client :', this._options.server);
    }

    callApi<T extends keyof ServiceType['req']>(apiName: T, req: ServiceType['req'][T], options: TransportOptions = {}): SuperPromise<ServiceType['res'][T], TsrpcError> {
        // GetService
        let service = this.serviceMap.apiName2Service[apiName as string];
        if (!service) {
            throw new Error('Invalid api name: ' + apiName);
        }

        // Encode
        let buf = TransportDataUtil.encodeApiReq(this.tsbuffer, service, req);
        let sn = this._apiSnCounter.getNext();
        this.logger.log(`[ApiReq] #${sn}`, apiName, req);

        // Send
        return this._sendBuf(buf, options, sn).then(resBuf => {
            // Parsed res
            let parsed = TransportDataUtil.parseServerOutout(this.tsbuffer, this.serviceMap, resBuf);
            if (parsed.type !== 'api') {
                throw new TsrpcError('Invalid response', 'INTERNAL_ERR');
            }
            if (parsed.isSucc) {
                this.logger.log(`[ApiRes] #${sn}`, parsed.res)
                return parsed.res;
            }
            else {
                this.logger.log(`[ApiErr] #${sn}`, parsed.error)
                throw parsed.error;
            }
        })
    }

    sendMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T], options: TransportOptions = {}): SuperPromise<void, TsrpcError> {
        // GetService
        let service = this.serviceMap.msgName2Service[msgName as string];
        if (!service) {
            throw new Error('Invalid msg name: ' + msgName);
        }

        let buf = TransportDataUtil.encodeMsg(this.tsbuffer, service, msg);
        return this._sendBuf(buf, options).then(() => { })
    }

    protected _sendBuf(buf: Uint8Array, options: TransportOptions = {}, apiSn?: number): SuperPromise<Buffer, TsrpcError> {
        let httpReq: http.ClientRequest;

        let promise = new SuperPromise<Buffer>((rs, rj) => {
            httpReq = http.request(this._options.server, {
                method: 'POST',
                timeout: options.timeout || this._options.timeout
            }, httpRes => {
                httpRes.on('data', (v: Buffer) => {
                    rs(v);
                });
                httpRes.on('end', () => {
                    rs();
                })
            });

            httpReq.on('abort', () => {
                if (!promise.isDone) {
                    apiSn && this.logger.log(`[ApiCancel] #${apiSn}`)
                }
            });

            httpReq.on('error', e => {
                // abort 不算错误
                if (promise.isCanceled) {
                    return;
                }

                rj(new TsrpcError(e.message, { isNetworkError: true, code: (e as any).code }));
            })

            httpReq.write(Buffer.from(buf));
            httpReq.end();
        });

        promise.onCancel(() => {
            console.log('onCancel')
            httpReq.abort();
        });

        return promise;
    }

}

const defaultHttpClientOptions: HttpClientOptions<any> = {
    server: 'http://localhost:3000',
    proto: { services: [], types: {} },
    logger: console,
    timeout: 30000
}

export interface HttpClientOptions<ServiceType extends BaseServiceType> {
    server: string;
    proto: ServiceProto<ServiceType>;
    logger: Logger;
    /** API超时时间（毫秒） */
    timeout: number;
}

