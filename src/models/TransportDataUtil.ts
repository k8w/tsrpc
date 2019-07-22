import { TSBuffer } from "tsbuffer";
import { ApiServiceDef, MsgServiceDef, ServerInputData, ServerOutputData, ApiError } from 'tsrpc-proto';
import { ServiceMap } from "./ServiceMapUtil";
import { TransportDataProto } from "tsrpc-proto";

export type ParsedServerInput = { type: 'api', service: ApiServiceDef, req: any, sn: number } | { type: 'msg', service: MsgServiceDef, msg: any };
export type ParsedServerOutput = { type: 'api', service: ApiServiceDef, sn: number } & ({ isSucc: true, res: any } | { isSucc: false, error: ApiError }) | { type: 'msg', service: MsgServiceDef, msg: any };

export class TransportDataUtil {

    private static _transportCoder?: TSBuffer;
    static get transportCoder(): TSBuffer {
        if (!this._transportCoder) {
            this._transportCoder = new TSBuffer(TransportDataProto)
        }

        return this._transportCoder;
    }

    static encodeApiSucc(tsbuffer: TSBuffer, service: ApiServiceDef, res: any, sn?: number) {
        let resBuf = tsbuffer.encode(res, service.res);
        return this.transportCoder.encode([service.id, resBuf, undefined, sn], 'ServerOutputData');
    }

    static encodeApiError(service: ApiServiceDef, message: string, info: any | undefined, sn: number) {
        return this.transportCoder.encode([service.id, undefined, { message: message, info: info }, sn >= 0 ? sn : undefined], 'ServerOutputData');
    }

    static encodeMsg(tsbuffer: TSBuffer, service: MsgServiceDef, msg: any) {
        let msgBuf = tsbuffer.encode(msg, service.msg);
        return this.transportCoder.encode([service.id, msgBuf], 'ServerOutputData');
    }

    static encodeApiReq(tsbuffer: TSBuffer, service: ApiServiceDef, req: any, sn?: number) {
        let reqBuf = tsbuffer.encode(req, service.req);
        return this.transportCoder.encode([service.id, reqBuf, sn ? sn : undefined], 'ServerInputData');
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
                sn: serverInputData[2] || 0
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
        let sn = serverOutputData[3] || 0;

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
                    error: apiError,
                    sn: sn
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
                    res: res,
                    sn: sn
                }
            }
        }
    }

}