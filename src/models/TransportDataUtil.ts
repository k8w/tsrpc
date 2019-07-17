import { TSBuffer } from "tsbuffer";
import { ApiServiceDef, MsgServiceDef } from '../proto/ServiceProto';
import { ServerInputData, ServerOutputData, ApiError } from '../proto/TransportData';
import { ServiceMap } from "./ServiceMapUtil";

export type ParsedServerInput = { type: 'api', service: ApiServiceDef, req: any, sn: number } | { type: 'msg', service: MsgServiceDef, msg: any };
export type ParsedServerOutput = { type: 'api', service: ApiServiceDef } & ({ isSucc: true, res: any } | { isSucc: false, error: ApiError }) | { type: 'msg', service: MsgServiceDef, msg: any };

export class TransportDataUtil {

    private static _transportCoder?: TSBuffer;
    static get transportCoder(): TSBuffer {
        if (!this._transportCoder) {
            this._transportCoder = new TSBuffer({
                "ServerInputData": {
                    "type": "Tuple",
                    "elementTypes": [
                        {
                            "type": "Number",
                            "scalarType": "uint"
                        },
                        {
                            "type": "Buffer",
                            "arrayType": "Uint8Array"
                        },
                        {
                            "type": "Number",
                            "scalarType": "uint"
                        }
                    ],
                    "optionalStartIndex": 2
                },
                "ServerOutputData": {
                    "type": "Tuple",
                    "elementTypes": [
                        {
                            "type": "Number",
                            "scalarType": "uint"
                        },
                        {
                            "type": "Buffer",
                            "arrayType": "Uint8Array"
                        },
                        {
                            "type": "Reference",
                            "target": "ApiError"
                        },
                        {
                            "type": "Number",
                            "scalarType": "uint"
                        }
                    ],
                    "optionalStartIndex": 1
                },
                "ApiError": {
                    "type": "Interface",
                    "properties": [
                        {
                            "id": 0,
                            "name": "message",
                            "type": {
                                "type": "String"
                            }
                        },
                        {
                            "id": 1,
                            "name": "info",
                            "type": {
                                "type": "Any"
                            },
                            "optional": true
                        }
                    ]
                }
            })
        }

        return this._transportCoder;
    }

    static encodeApiSucc(tsbuffer: TSBuffer, service: ApiServiceDef, res: any, sn?: number) {
        let resBuf = tsbuffer.encode(res, service.res);
        return this.transportCoder.encode([service.id, resBuf, undefined, sn], 'ServerOutputData');
    }

    static encodeApiError(service: ApiServiceDef, message: string, info?: any, sn?: number) {
        return this.transportCoder.encode([service.id, undefined, { message: message, info: info }, sn], 'ServerOutputData');
    }

    static encodeMsg(tsbuffer: TSBuffer, service: MsgServiceDef, msg: any) {
        let msgBuf = tsbuffer.encode(msg, service.msg);
        return this.transportCoder.encode([service.id, msgBuf], 'ServerOutputData');
    }

    static encodeApiReq(tsbuffer: TSBuffer, service: ApiServiceDef, req: any) {
        let reqBuf = tsbuffer.encode(req, service.req);
        return this.transportCoder.encode([service.id, reqBuf], 'ServerInputData');
    }

    static parseServerInput(tsbuffer: TSBuffer, serviceMap: ServiceMap, buf: Uint8Array): ParsedServerInput {
        let serverInputData = this.transportCoder.decode(buf, 'ServerInputData') as ServerInputData;

        // 确认是哪个Service
        let service = serviceMap.id2Service[serverInputData[0]];
        if (!service) {
            throw new Error(`Cannot find service ID: ${serverInputData[0]}`)
        }

        // 解码Body
        if (service.type === 'api') {
            let req = tsbuffer.decode(serverInputData[1], service.req);
            return {
                type: 'api',
                service: service,
                req: req,
                sn: serverInputData[2] || -1
            }
        }
        else {
            let msg = tsbuffer.decode(serverInputData[1], service.msg);
            return {
                type: 'msg',
                service: service,
                msg: msg
            }
        }
    }

    static parseServerOutout(tsbuffer: TSBuffer, serviceMap: ServiceMap, buf: Uint8Array): ParsedServerOutput {
        let serverOutputData = this.transportCoder.decode(buf, 'ServerOutputData') as ServerOutputData;
        let serviceId = serverOutputData[0];
        let buffer = serverOutputData[1];
        let apiError = serverOutputData[2];
        let sn = serverOutputData[3];

        let service = serviceMap.id2Service[serviceId];
        if (!service) {
            throw new Error(`Cannot find service ID: ${serviceId}`)
        }

        if (service.type === 'msg') {
            if (!buffer) {
                throw new Error('Empty msg buffer');
            }
            let msg = tsbuffer.decode(buffer, service.msg);
            return {
                type: 'msg',
                service: service,
                msg: msg
            }
        }
        else {
            if (apiError) {
                return {
                    type: 'api',
                    service: service,
                    isSucc: false,
                    error: apiError
                }
            }
            else {
                if (!buffer) {
                    throw new Error('Empty res buffer');
                }
                let res = tsbuffer.decode(buffer, service.res);
                return {
                    type: 'api',
                    service: service,
                    isSucc: true,
                    res: res
                }
            }
        }
    }

}