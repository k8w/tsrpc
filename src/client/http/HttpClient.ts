import { BaseServiceType, ServiceProto, TsrpcError } from "tsrpc-proto";
import { ServiceMapUtil, ServiceMap } from '../../models/ServiceMapUtil';
import { TSBuffer } from "tsbuffer";
import { TransportDataUtil, ParsedServerOutput } from '../../models/TransportDataUtil';
import * as http from "http";
import * as https from "https";
import { Counter } from '../../models/Counter';
import { Logger } from '../../server/Logger';
import { TransportOptions } from "../models/TransportOptions";
import SuperPromise from 'k8w-super-promise';
import { nodeUtf8 } from '../../models/nodeUtf8';

export class HttpClient<ServiceType extends BaseServiceType = any> {

    private _options: HttpClientOptions<ServiceType>;
    serviceMap: ServiceMap;
    tsbuffer: TSBuffer;
    logger: Logger;

    private _http: typeof http | typeof https;
    private _snCounter = new Counter(1);

    lastReceivedBuf?: Uint8Array;

    constructor(options?: Partial<HttpClientOptions<ServiceType>>) {
        this._options = Object.assign({}, defaultHttpClientOptions, options);
        this.serviceMap = ServiceMapUtil.getServiceMap(this._options.proto);
        this.tsbuffer = new TSBuffer(this._options.proto.types, {
            utf8: nodeUtf8
        });
        this.logger = this._options.logger;

        this._http = this._options.server.startsWith('https://') ? https : http;

        this.logger.log('TSRPC HTTP Client :', this._options.server);
    }

    callApi<T extends keyof ServiceType['req']>(apiName: T, req: ServiceType['req'][T], options: TransportOptions = {}): SuperPromise<ServiceType['res'][T], TsrpcError> {
        let sn = this._snCounter.getNext();
        this.logger.log(`[ApiReq] #${sn}`, apiName, req);

        // GetService
        let service = this.serviceMap.apiName2Service[apiName as string];
        if (!service) {
            throw new TsrpcError('Invalid api name: ' + apiName, {
                code: 'INVALID_SERVICE_NAME',
                isClientError: true
            });
        }

        // Encode
        let buf = TransportDataUtil.encodeApiReq(this.tsbuffer, service, req);

        // Send
        return this._sendBuf(buf, options, 'api', sn).then(resBuf => {
            if (!resBuf) {
                throw new TsrpcError('Unknown Error', {
                    code: 'EMPTY_RES',
                    isServerError: true
                })
            }

            // Parsed res
            let parsed: ParsedServerOutput;
            try {
                parsed = TransportDataUtil.parseServerOutout(this.tsbuffer, this.serviceMap, resBuf);
            }
            catch (e) {
                throw new TsrpcError('Invalid server output', {
                    code: 'INVALID_SERVER_OUTPUT',
                    isServerError: true,
                    innerError: e,
                    buf: resBuf
                });
            }
            if (parsed.type !== 'api') {
                throw new TsrpcError('Invalid response', {
                    code: 'INVALID_API_ID',
                    isServerError: true
                });
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
        let sn = this._snCounter.getNext();
        this.logger.log(`[SendMsg] #${sn}`, msgName, msg);

        // GetService
        let service = this.serviceMap.msgName2Service[msgName as string];
        if (!service) {
            throw new TsrpcError('Invalid msg name: ' + msgName, {
                code: 'INVALID_SERVICE_NAME',
                isClientError: true
            });
        }

        let buf = TransportDataUtil.encodeMsg(this.tsbuffer, service, msg);
        return this._sendBuf(buf, options, 'msg', sn).then(() => { })
    }

    protected _sendBuf(buf: Uint8Array, options: TransportOptions = {}, type: 'api' | 'msg', sn: number): SuperPromise<Uint8Array | undefined, TsrpcError> {
        this._options.debugBuf && this.logger.debug('[SendBuf]', '#' + sn, buf);
        if (this._options.encrypter) {
            buf = this._options.encrypter(buf);
        }
        this._options.debugBuf && this.logger.debug('[EncryptedBuf]', '#' + sn, buf);

        let httpReq: http.ClientRequest;

        let promiseRj: Function;
        let promise = new SuperPromise<Uint8Array, TsrpcError>((rs, rj) => {
            promiseRj = rj;
            httpReq = this._http.request(this._options.server, {
                method: 'POST',
                agent: this._options.agent
            }, httpRes => {
                let data: Buffer[] = [];
                httpRes.on('data', (v: Buffer) => {
                    data.push(v)
                });
                httpRes.on('end', () => {
                    let buf: Uint8Array = Buffer.concat(data)
                    this.lastReceivedBuf = buf;
                    this._options.debugBuf && this.logger.debug('[RecvBuf]', '#' + sn, buf);
                    if (this._options.decrypter) {
                        buf = this._options.decrypter(buf);
                    }
                    this._options.debugBuf && this.logger.debug('[DecryptedBuf]', '#' + sn, buf);
                    rs(buf);
                })
            });

            httpReq.on('abort', () => {
                if (!promise.isDone) {
                    this.logger.log(`[${type === 'api' ? 'ApiCancel' : 'MsgCancel'}] #${sn}`)
                }
            });

            httpReq.on('error', e => {
                // abort 不算错误
                if (promise.isCanceled) {
                    return;
                }

                rj(new TsrpcError(e.message, {
                    code: (e as any).code,
                    isNetworkError: true
                }));
            })

            httpReq.write(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength));
            httpReq.end();
        });

        promise.onCancel(() => {
            httpReq.abort();
        });

        let timer: NodeJS.Timeout | undefined;
        let timeout = options.timeout || this._options.timeout;
        if (timeout) {
            timer = setTimeout(() => {
                if (!promise.isCanceled && !promise.isDone) {
                    this.logger.log(`[${type === 'api' ? 'ApiTimeout' : 'MsgTimeout'}] #${sn}`);
                    promiseRj(new TsrpcError('Request Timeout', {
                        code: 'TIMEOUT',
                        isNetworkError: true
                    }));
                    httpReq.abort();
                }
            }, timeout);
        }

        promise.then(v => {
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
            return v;
        });

        promise.catch(e => {
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
            throw e;
        })

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
    agent?: http.Agent;

    // 加密选项
    encrypter?: (src: Uint8Array) => Uint8Array;
    decrypter?: (cipher: Uint8Array) => Uint8Array;
    /** 为true时将会把buf信息打印在log中 */
    debugBuf?: boolean
}

