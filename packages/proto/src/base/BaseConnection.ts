import { Overwrite } from "k8w-extend-native";
import { TransportDataSchema } from "../proto/TransportDataSchema";

export abstract class BaseConnection {

    constructor(private _baseOptions: BaseConnectionOptions) {
        this._listenData(this._recvData.bind(this));
    }

    // API
    callApi() { }
    implementApi() { }

    // Message
    sendMsg() { }
    listenMsg() { }

    // Transport
    // 到这一步已经经过类型检测
    // DataFlow 面向二进制 Payload
    // TODO 序列化过程应该是在 Transport 之内的，不同信道（HTTP、WS、Obj）序列化方式不同
    // HTTP JSON：fetch data->body header->header serviceId->URL
    // HTTP BUF: fetch all in body
    // WS JSON: all in json body, serviceId -> service: {'data/AddData'}
    // WS BUF: all in body
    protected abstract _sendData(data: TransportData): void;
    protected abstract _listenData(func: (data: TransportData) => void): void;

    private _recvData(data: TransportData) {

    }
}

export interface BaseConnectionOptions {
    // Validate
    skipReqValidate?: boolean;
    skipResValidate?: boolean;
    skipMsgValidate?: boolean;

    // Serialization
    jsonEncoder?: any;
    jsonDecoder?: any;
    bufferEncoder?: any;
    bufferDecoder?: any;
}

/**
 * Basic transport data unit,
 * which represents data that sended by server/client.
 */
export type TransportData = TransportData_RPC | TransportData_NonRPC;
export type TransportData_RPC = Overwrite<TransportDataSchema & { type: 'req' | 'res' | 'err' | 'msg' }, { data: any }>;
export type TransportData_NonRPC = TransportDataSchema & { type: Exclude<TransportDataSchema['type'], TransportData_RPC['type']> };

// SERVER
export interface HttpConnOptions extends BaseConnectionOptions {
    id: number;
    ip: string,
    server: any,
    dataType: 'string' | 'buffer' | 'object',
    httpReq: http.IncomingMessage,
    httpRes: http.ServerResponse,
}

// CLIENT