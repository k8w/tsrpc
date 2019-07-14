import WebSocket from 'ws';
import { MsgServiceDef, ApiServiceDef, ServiceProto, ServiceDef } from '../proto/ServiceProto';
import { ServerInputData, ServerOutputData, ApiError } from '../proto/TransportData';
import { TSBuffer } from 'tsbuffer';
import { Counter } from './Counter';
import { TsrpcError } from './TsrpcError';

export interface CreateTransporterOptions {
    ws?: WebSocket,
    proto: ServiceProto,
    onRecvData: Transporter['onRecvData'],

    // Server 传入 可以复用的
    tsbuffer?: TSBuffer,
    serviceMap?: ServiceMap
}

export class Transporter {

    

    readonly type: 'client' | 'server';

    private _ws?: WebSocket;
    private _tsbuffer!: TSBuffer;
    private _serviceMap!: ServiceMap;
    onRecvData!: (data: RecvData) => void;

    private _apiReqSnCounter!: Counter;


    private constructor(type: Transporter['type'], options: CreateTransporterOptions) {
        this.type = type;
        if (this.type === 'client') {
            this._apiReqSnCounter = new Counter();
        }
    }

    private static _pool: Transporter[] = [];
    static getFromPool(type: 'client' | 'server', options: CreateTransporterOptions): Transporter {
        let item = this._pool.pop();
        if (!item) {
            item = new Transporter(type, options);
        }

        // RESET
        item._tsbuffer = options.tsbuffer || new TSBuffer(options.proto.types);
        item._serviceMap = options.serviceMap || Transporter.getServiceMap(options.proto);
        item.onRecvData = options.onRecvData;

        if (item.type === 'client') {
            item._apiReqSnCounter.reset();
        }

        item.resetWs(options.ws);

        return item;
    }
    static putIntoPool(item: Transporter) {
        if (this._pool.indexOf(item) > -1) {
            return;
        }

        item._tsbuffer = null as any;
        item.onRecvData = null as any;
        item._serviceMap = null as any;
        item.resetWs(undefined);
        this._pool.push(item);
    }

    resetWs(ws: WebSocket | undefined) {
        // 清空上一次的
        if (this._ws) {
            this._ws.onmessage = undefined as any;
        }

        this._ws = ws;
        if (this._ws) {
            this._ws.onmessage = e => { this._onWsMessage(e.data) };
        }
    }

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

    async sendMsg(msgName: string, msg: any) {
        // GetService
        let service = this._serviceMap.msgName2Service[msgName];
        if (!service) {
            throw new Error('Invalid msg name: ' + msgName)
        }

        // Encode
        let buf = this._tsbuffer.encode(msg, service.msg);

        // Send Data
        await this._sendTransportData(service.id, buf);
    }

    /**
     * @return SN
     */
    sendApiReq(apiName: string, req: any): number {
        if (this.type !== 'client') {
            throw new Error('sendApiReq method is only for client use');
        }

        // GetService
        let service = this._serviceMap.apiName2Service[apiName];
        if (!service) {
            throw new Error('Invalid api name: ' + apiName);
        }

        // Encode
        let buf = this._tsbuffer.encode(req, service.req);

        // Transport Encode
        let sn = this._apiReqSnCounter.getNext();

        // Send Data
        this._sendTransportData(service.id, buf, sn);

        return sn;
    }

    sendApiSucc(service: ApiServiceDef, sn: number, res: any) {
        if (this.type !== 'server') {
            throw new Error('sendApiReq sendApiSucc is only for server use');
        }

        // Encode Res Body
        let buf = this._tsbuffer.encode(res, service.res);

        // Send
        this._sendTransportData(service.id, buf, sn, true);
    }

    sendApiError(service: ApiServiceDef, sn: number, message: string, info?: any): ApiError {
        if (this.type !== 'server') {
            throw new Error('sendApiReq sendApiSucc is only for server use');
        }

        // Encode Res Body
        let err: ApiError = {
            message: message,
            info: info
        }
        let buf = Transporter.transportCoder.encode(err, 'ApiError');

        // Send
        this._sendTransportData(service.id, buf, sn, false);

        return err;
    }

    private _onWsMessage = (data: WebSocket.Data) => {
        // 文字消息
        if (typeof data === 'string') {
            this.onRecvData({ type: 'text', data: data });
        }
        // Buffer
        else if (Buffer.isBuffer(data)) {
            // 解码TransportData
            let decRes = Transporter._tryDecode(Transporter.transportCoder, data, 'ServerOutputData');
            if (!decRes.isSucc) {
                console.debug('[INVALID_DATA]', 'Cannot decode data', `data.length=${data.length}`, decRes.error);
                this.onRecvData({ type: 'buffer', data: data });
                return;
            }
            let transportData = decRes.output as ServerInputData | ServerOutputData;

            // 确认是哪个Service
            let service = this._serviceMap.id2Service[transportData[0]];
            if (!service) {
                console.warn('[INVALID_DATA]', `Cannot find service ID: ${transportData[0]}`);
                this.onRecvData({ type: 'buffer', data: data });
                return;
            }

            // Handle API
            if (service.type === 'api') {
                let sn = transportData[2];
                let isSucc = transportData[3];

                // Client: ApiRes
                if (this.type === 'client') {
                    if (sn === undefined || isSucc === undefined) {
                        console.warn('[INVALID_RES]', 'Missing SN or isSucc', `SN=${sn} isSucc=${isSucc}`);
                        return;
                    }

                    // Parse body
                    let decRes = isSucc ?
                        Transporter._tryDecode(this._tsbuffer, transportData[1], service.res)
                        : Transporter._tryDecode(Transporter.transportCoder, transportData[1], 'ApiError');
                    if (!decRes.isSucc) {
                        console.warn('[INVALID_RES]', decRes.error.message);
                        this.onRecvData({ type: 'buffer', data: data });
                        return;
                    }

                    this.onRecvData({ type: 'apiRes', service: service, data: decRes.output, sn: sn, isSucc: isSucc });
                }
                // Server: ApiReq
                else {
                    if (sn === undefined) {
                        console.warn('[INVALID_REQ]', 'Invalid API Request', `SN=${sn}`);
                        return;
                    }

                    // Parse body
                    let decRes = Transporter._tryDecode(this._tsbuffer, transportData[1], service.req);
                    if (!decRes.isSucc) {
                        console.warn('[INVALID_REQ]', decRes.error);
                        this.onRecvData({ type: 'buffer', data: data });
                        return;
                    }

                    this.onRecvData({ type: 'apiReq', service: service, data: decRes.output, sn: sn });
                }
            }
            // Handle Msg
            else {
                // Parse body
                let decRes = Transporter._tryDecode(this._tsbuffer, transportData[1], service.msg);
                if (!decRes.isSucc) {
                    console.warn('[INVALID_MSG]', decRes.error);
                    this.onRecvData({ type: 'buffer', data: data });
                    return;
                }
                this.onRecvData({ type: 'msg', service: service, data: decRes.output })
            }
        }
        else {
            console.warn('Unexpected message type', data);
        }
    }

    private _sendTransportData(serviceId: number, buf: Uint8Array): Promise<void>;
    private _sendTransportData(serviceId: number, buf: Uint8Array, sn: number): void;
    private _sendTransportData(serviceId: number, buf: Uint8Array, sn: number, isSucc: boolean): void;
    private _sendTransportData(serviceId: number, buf: Uint8Array, sn?: number, isSucc?: boolean): void | Promise<void> {
        if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
            throw new TsrpcError('Connection is not ready', 'NETWORK_ERROR')
        }

        // Server send ServerOutputData
        let transportData: Uint8Array;
        if (this.type === 'server') {
            let data: ServerOutputData = sn === undefined ? [serviceId, buf] : [serviceId, buf, sn, isSucc];
            transportData = Transporter.transportCoder.encode(data, 'ServerOutputData');
        }
        // Client send ServerInputData
        else {
            let data: ServerInputData = sn === undefined ? [serviceId, buf] : [serviceId, buf, sn];
            transportData = Transporter.transportCoder.encode(data, 'ServerInputData');
        }

        // Msg can await
        if (sn === undefined) {
            return new Promise((rs, rj) => {
                this._ws!.send(transportData, err => {
                    err ? rj(err) : rs();
                });
            })
        }
        // Api no need await
        else {
            this._ws.send(transportData);
        }
    }

    private static _tryEncode(encoder: TSBuffer, value: any, schemaId: string): { isSucc: true, output: Uint8Array } | { isSucc: false, error: Error } {
        try {
            let output = encoder.encode(value, schemaId);
            return {
                isSucc: true,
                output: output
            }
        }
        catch (e) {
            return {
                isSucc: false,
                error: e
            }
        }
    }

    private static _tryDecode(decoder: TSBuffer, buf: Uint8Array, schemaId: string): { isSucc: true, output: unknown } | { isSucc: false, error: Error } {
        try {
            let output = decoder.decode(buf, schemaId);
            return {
                isSucc: true,
                output: output
            }
        }
        catch (e) {
            return {
                isSucc: false,
                error: e
            }
        }
    }

}

export type RecvTextData = {
    type: 'text',
    data: string
}

export type RecvBufferData = {
    type: 'buffer',
    data: Uint8Array
}

export type RecvApiReqData = {
    type: 'apiReq',
    service: ApiServiceDef,
    data: any,
    sn: number,
}

export type RecvApiResData = {
    type: 'apiRes',
    service: ApiServiceDef,
    data: any,
    sn: number,
    isSucc: boolean
}

export type RecvMsgData = {
    type: 'msg',
    service: MsgServiceDef,
    data: any
}

export type RecvData = RecvTextData | RecvBufferData | RecvApiReqData | RecvApiResData | RecvMsgData;

export interface ServiceMap {
    id2Service: { [serviceId: number]: ServiceDef },
    apiName2Service: { [apiName: string]: ApiServiceDef | undefined },
    msgName2Service: { [msgName: string]: MsgServiceDef | undefined }
}