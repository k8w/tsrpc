import { EncodeOutput, TSBuffer } from "tsbuffer";
import { ServerInputData, ServerOutputData, TransportDataProto, TsrpcError } from 'tsrpc-proto';
import { ApiReturn } from "./ApiReturn";
import { nodeUtf8 } from "./nodeUtf8";
import { ApiService, MsgService, ServiceMap } from "./ServiceMapUtil";

export type ParsedServerInput = { type: 'api', service: ApiService, req: any, sn?: number } | { type: 'msg', service: MsgService, msg: any };
export type ParsedServerOutput = { type: 'api', service: ApiService, sn?: number } & ({ isSucc: true, res: any } | { isSucc: false, error: TsrpcError }) | { type: 'msg', service: MsgService, msg: any };

export class TransportDataUtil {

    private static _tsbuffer?: TSBuffer;
    static get tsbuffer(): TSBuffer {
        if (!this._tsbuffer) {
            this._tsbuffer = new TSBuffer(TransportDataProto, {
                utf8Coder: nodeUtf8
            })
        }

        return this._tsbuffer;
    }

    static encodeApiReturn(tsbuffer: TSBuffer, service: ApiService, apiReturn: ApiReturn<any>, sn?: number): EncodeOutput {
        let serverOutputData: ServerOutputData = {
            sn: sn,
            serviceId: sn !== undefined ? service.id : undefined
        };
        if (apiReturn.isSucc) {
            let op = tsbuffer.encode(apiReturn.res, service.reqSchemaId);
            if (!op.isSucc) {
                return op;
            }
            serverOutputData.buffer = op.buf;
        }
        else {
            serverOutputData.error = apiReturn.err;
        }

        return this.tsbuffer.encode(serverOutputData, 'ServerOutputData');
    }

    static encodeMsg(tsbuffer: TSBuffer, service: MsgService, msg: any): EncodeOutput {
        let op = tsbuffer.encode(msg, service.msgSchemaId);
        if (!op.isSucc) {
            return op;
        }

        let serverOutputData: ServerOutputData = {
            serviceId: service.id,
            buffer: op.buf
        }
        return this.tsbuffer.encode(serverOutputData, 'ServerOutputData');
    }

    static encodeApiReq(tsbuffer: TSBuffer, service: ApiService, req: any, sn?: number): EncodeOutput {
        let op = tsbuffer.encode(req, service.reqSchemaId);
        if (!op.isSucc) {
            return op;
        }
        let serverInputData: ServerInputData = {
            serviceId: service.id,
            buffer: op.buf,
            sn: sn
        }
        return this.tsbuffer.encode(serverInputData, 'ServerInputData');
    }

    static parseServerInput(tsbuffer: TSBuffer, serviceMap: ServiceMap, buf: Uint8Array): { isSucc: true, result: ParsedServerInput } | { isSucc: false, errMsg: string } {
        let opServerInputData = this.tsbuffer.decode(buf, 'ServerInputData');
        if (!opServerInputData.isSucc) {
            return opServerInputData;
        }
        let serverInput = opServerInputData.value as ServerInputData;

        // 确认是哪个Service
        let service = serviceMap.id2Service[serverInput.serviceId];
        if (!service) {
            return { isSucc: false, errMsg: `Cannot find service ID: ${serverInput.serviceId}` }
        }

        // 解码Body
        if (service.type === 'api') {
            let opReq = tsbuffer.decode(serverInput.buffer, service.reqSchemaId);
            return opReq.isSucc ? {
                isSucc: true,
                result: {
                    type: 'api',
                    service: service,
                    req: opReq.value,
                    sn: serverInput.sn
                }
            } : opReq
        }
        else {
            let opMsg = tsbuffer.decode(serverInput.buffer, service.msgSchemaId);
            return opMsg.isSucc ? {
                isSucc: true,
                result: {
                    type: 'msg',
                    service: service,
                    msg: opMsg.value
                }
            } : opMsg;
        }
    }

    static parseServerOutout(tsbuffer: TSBuffer, serviceMap: ServiceMap, buf: Uint8Array, serviceId?: number): { isSucc: true, result: ParsedServerOutput } | { isSucc: false, errMsg: string } {
        let opServerOutputData = this.tsbuffer.decode<ServerOutputData>(buf, 'ServerOutputData');
        if (!opServerOutputData.isSucc) {
            return opServerOutputData;
        }
        let serverOutputData = opServerOutputData.value;
        serviceId = serviceId ?? serverOutputData.serviceId;
        if (serviceId === undefined) {
            return { isSucc: false, errMsg: `Missing 'serviceId'` };
        }

        let service = serviceMap.id2Service[serviceId];
        if (!service) {
            return { isSucc: false, errMsg: `Cannot find service ID: ${serviceId}` };
        }

        if (service.type === 'msg') {
            if (!serverOutputData.buffer) {
                return { isSucc: false, errMsg: 'Empty msg buffer' };
            }
            let opMsg = tsbuffer.decode(serverOutputData.buffer, service.msgSchemaId);
            if (!opMsg.isSucc) {
                return opMsg;
            }

            return {
                isSucc: true,
                result: {
                    type: 'msg',
                    service: service,
                    msg: opMsg.value
                }
            }
        }
        else {
            if (serverOutputData.error) {
                return {
                    isSucc: true,
                    result: {
                        type: 'api',
                        service: service,
                        isSucc: false,
                        error: serverOutputData.error,
                        sn: serverOutputData.sn
                    }
                }
            }
            else {
                if (!serverOutputData.buffer) {
                    return { isSucc: false, errMsg: 'Empty API res buffer' };
                }

                let opRes = tsbuffer.decode(serverOutputData.buffer, service.resSchemaId);
                if (!opRes.isSucc) {
                    return opRes;
                }

                return {
                    isSucc: true,
                    result: {
                        type: 'api',
                        service: service,
                        isSucc: true,
                        res: opRes.value,
                        sn: serverOutputData.sn
                    }
                }
            }
        }
    }

}