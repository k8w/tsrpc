import { PickUnion } from "k8w-extend-native";
import { TSBuffer } from "tsbuffer";
import { TSBufferProto } from "tsbuffer-schema";
import { OpResult } from "../models/OpResult";
import { ApiService, MsgService, ServiceMap } from "../models/ServiceMapUtil";
import { TransportDataProto } from "../proto/TransportDataProto";
import { TsrpcError } from "../proto/TsrpcError";
import { BoxBuffer, BoxTextDecoding, BoxTextEncoding, TransportData } from "./TransportData";

// Send buffer: TransportData -> BoxBuffer -> Uint8Array
// Send text: TransportData -> BoxText -> string
// Recv buffer: Uint8Array -> BoxBuffer -> TransportData
// Recv text: string -> BoxJsonObject -> TransportData
export class TransportDataUtil {

    private static _tsbuffer?: TSBuffer;
    static get tsbuffer(): TSBuffer {
        if (!this._tsbuffer) {
            this._tsbuffer = new TSBuffer(TransportDataProto as TSBufferProto)
        }

        return this._tsbuffer;
    }

    /**
     * @returns null 代表无需编码 body
     */
    private static _getBodyInfo(transportData: { type: string, serviceName?: string }, serviceMap: ServiceMap, action: 'encode' | 'decode'): OpResult<{ serviceId: number, schemaId: string } | null> {
        // Get schemaId
        const { type, serviceName } = transportData;
        if (serviceName) {

            let service: ApiService | MsgService | undefined;
            // msg: {type:msg}
            if (type === 'msg') {
                service = serviceMap.name2Msg[serviceName]
            }
            // localApi: dec-req || enc-other
            else if (action === 'decode' && type === 'req' || action === 'encode' && type !== 'req') {
                service = serviceMap.name2LocalApi[serviceName]
            }
            // remoteApi: enc-req || dec-other
            else if (action === 'encode' && type === 'req' || action === 'decode' && type !== 'req') {
                service = serviceMap.name2RemoteApi[serviceName]
            }
            if (!service) {
                return { isSucc: false, errMsg: `Undefined ${type === 'msg' ? 'Msg' : 'API'} name: ${serviceName}` }
            }

            return {
                isSucc: true,
                res: {
                    serviceId: service.id,
                    schemaId: type === 'req' ? (service as ApiService).reqSchemaId
                        : type === 'res' ? (service as ApiService).resSchemaId
                            : (service as MsgService).msgSchemaId
                }
            };
        }

        return { isSucc: true, res: null };
    }

    static encodeBodyBuffer(transportData: TransportData, serviceMap: ServiceMap, tsbuffer: TSBuffer, skipValidate: boolean | undefined): OpResult<BoxBuffer> {
        let opBodyInfo = this._getBodyInfo(transportData, serviceMap, 'encode');
        if (!opBodyInfo.isSucc) { return opBodyInfo };

        // Encode body
        if (opBodyInfo.res) {
            let { serviceName, body, ...rest } = transportData as TransportData & { type: 'req' | 'res' | 'msg' } & { serviceName?: string };
            let opEncode = tsbuffer.encode(body, opBodyInfo.res.schemaId, { skipValidate })
            if (!opEncode.isSucc) { return opEncode };

            // Make BoxBuffer (replace body by buffer)
            return {
                isSucc: true,
                res: {
                    ...rest,
                    serviceId: opBodyInfo.res.serviceId,
                    body: opEncode.buf,
                }
            }
        }
        // No need to encode
        else {
            return { isSucc: true, res: transportData as TransportData & { type: Exclude<TransportData['type'], 'req' | 'res' | 'msg'> } };
        }
    }

    static encodeBodyText(transportData: TransportData, serviceMap: ServiceMap, tsbuffer: TSBuffer, skipValidate: boolean | undefined, stringifyBodyJson: ((bodyJson: Object, transportData: TransportData, schemaId: string) => string) | undefined): OpResult<BoxTextEncoding> {
        let opBodyInfo = this._getBodyInfo(transportData, serviceMap, 'encode');
        if (!opBodyInfo.isSucc) { return opBodyInfo };

        // Encode body
        if (opBodyInfo.res) {
            let { body, ...rest } = transportData as TransportData & { type: 'req' | 'res' | 'msg' } & { apiName?: string };
            let opEncode = tsbuffer.encodeJSON(body, opBodyInfo.res.schemaId, { skipValidate })
            if (!opEncode.isSucc) { return opEncode };

            // Make BoxText (replace body by text)
            return {
                isSucc: true,
                res: {
                    ...rest,
                    body: stringifyBodyJson ? stringifyBodyJson(opEncode.json, transportData, opBodyInfo.res.schemaId) : JSON.stringify(opEncode.json)
                }
            }
        }
        // No need to encode
        else {
            return { isSucc: true, res: transportData as TransportData & { type: Exclude<TransportData['type'], 'req' | 'res' | 'msg'> } };
        }
    }

    static encodeBoxBuffer(box: BoxBuffer): OpResult<Uint8Array> {
        // Box 都是代码构造的，所以无需类型检查
        let op = this.tsbuffer.encode(box, 'BoxBuffer', { skipValidate: true });
        if (!op.isSucc) {
            return op;
        }
        return { isSucc: true, res: op.buf }
    }

    static encodeBoxText(box: BoxTextEncoding, skipSN: boolean | undefined): OpResult<string> {
        switch (box.type) {
            case 'req':
            case 'res':
            case 'err': {
                const protoInfo = box.protoInfo;
                return {
                    isSucc: true,
                    res: `{"type":"${box.type}"`    // type
                        + (box.type === 'req' ? `",serviceName":"${box.serviceName}"` : '') // serviceName
                        + (skipSN ? '' : `,"sn":${box.sn}`) // sn
                        + (box.type === 'err' ? `,"err":${JSON.stringify(box.err)}` : `,"body":${box.body}`) // body/err
                        + (protoInfo ? `,"protoInfo":{"lastModified":"${protoInfo.lastModified}","md5":"${protoInfo.md5}","tsrpc":"${protoInfo.tsrpc}",${protoInfo.node ? `,"node":"${protoInfo.node}"` : ''}}` : '') // protoInfo
                        + '}'
                };
            }
            case 'msg': {
                return {
                    isSucc: true,
                    res: `{"type":"msg","serviceName":"${box.serviceName}","body":${box.body}}`
                };
            }
            default:
                return { isSucc: true, res: JSON.stringify(box) }
        }
    }

    private static _pick<T, U extends keyof T>(obj: T, keys: U[]): PickUnion<T, U> {
        let output: any = {};
        for (let k in keys) {
            output[k] = obj[k as U];
        }
        return output;
    }

    static decodeBoxBuffer(data: Uint8Array, pendingCallApis: Map<number, { apiName: string }>, serviceMap: ServiceMap, skipValidate: boolean | undefined): OpResult<BoxBuffer> {
        let op = this.tsbuffer.decode(data, 'BoxBuffer', { skipValidate });
        if (!op.isSucc) {
            if (op.errPhase !== 'validate') {
                op.errMsg = 'Unknown buffer encoding'
            }
            return op
        }

        let box = op.value as BoxBuffer;
        if (box.type === 'res') {
            const item = pendingCallApis.get(box.sn);
            if (!item) {
                return { isSucc: false, errMsg: `Invalid SN for callApi return: ${box.sn}` };
            }
            box.serviceId = serviceMap.name2RemoteApi[item.apiName]!.id;
        }

        return { isSucc: true, res: box }
    }

    static decodeBoxText(data: string, pendingCallApis: Map<number, { apiName: string }>, skipValidate: boolean | undefined, ...decodeBoxTextOptions: any[]): OpResult<BoxTextDecoding> {
        try {
            var box = JSON.parse(data) as BoxTextDecoding;
        }
        catch (e: any) {
            return { isSucc: false, errMsg: 'Invalid JSON string: ' + e.message }
        }

        if (!skipValidate) {
            let vRes = this.tsbuffer.validate(box, 'BoxJsonObject');
            if (!vRes.isSucc) {
                return {
                    ...vRes,
                    errPhase: 'validate'
                };
            }
        }

        if (box.type === 'res') {
            const item = pendingCallApis.get(box.sn);
            if (!item) {
                return { isSucc: false, errMsg: `Invalid SN for callApi return: ${box.sn}` };
            }
            box.serviceName = item.apiName;
        }

        return { isSucc: true, res: box };
    }

    static decodeBodyBuffer(box: BoxBuffer, serviceMap: ServiceMap, tsbuffer: TSBuffer, skipValidate: boolean | undefined): OpResult<TransportData> & { errPhase?: 'decode' | 'validate' } {
        let opBodyInfo = this._getBodyInfo(box, serviceMap, 'decode');
        if (!opBodyInfo.isSucc) { return opBodyInfo };

        // Decode body
        if (opBodyInfo.res) {
            const { body, serviceId, ...rest } = box as BoxBuffer & { type: 'req' | 'res' | 'msg' };
            const service = serviceMap.id2Service[serviceId];
            if (!service) {
                return { isSucc: false, errMsg: `Invalid serviceId: ${serviceId}` };
            }

            let opDecode = tsbuffer.decode(body, opBodyInfo.res.schemaId, { skipValidate });
            if (!opDecode.isSucc) {
                return opDecode;
            }

            return {
                isSucc: true,
                res: {
                    ...rest,
                    serviceName: service.name,
                    body: opDecode.value
                }
            }
        }
        // err: TsrpcErrorData -> TsrpcError
        else if (box.type === 'err') {
            return {
                isSucc: true,
                res: {
                    ...box,
                    err: new TsrpcError(box.err)
                }
            }
        }
        // No need to decode body
        else {
            return { isSucc: true, res: box as BoxBuffer & { type: Exclude<BoxBuffer['type'], 'req' | 'res' | 'msg'> } };
        }
    }

    static decodeBodyText(box: BoxTextDecoding, serviceMap: ServiceMap, tsbuffer: TSBuffer, skipValidate: boolean | undefined): OpResult<TransportData> & { errPhase?: 'decode' | 'validate' } {
        let opBodyInfo = this._getBodyInfo(box, serviceMap, 'decode');
        if (!opBodyInfo.isSucc) { return opBodyInfo };

        // Decode body
        if (opBodyInfo.res) {
            const { body, ...rest } = box as BoxTextDecoding & { type: 'req' | 'res' | 'msg' };
            let opDecode = tsbuffer.decodeJSON(body, opBodyInfo.res.schemaId, { skipValidate });
            if (!opDecode.isSucc) {
                return opDecode;
            }

            return {
                isSucc: true,
                res: {
                    ...rest,
                    body: opDecode.value
                }
            }
        }
        // err: TsrpcErrorData -> TsrpcError
        else if (box.type === 'err') {
            return {
                isSucc: true,
                res: {
                    ...box,
                    err: new TsrpcError(box.err)
                }
            }
        }
        // No need to decode body
        else {
            return { isSucc: true, res: box as BoxTextDecoding & { type: Exclude<BoxTextDecoding['type'], 'req' | 'res' | 'msg'> } };
        }
    }

}