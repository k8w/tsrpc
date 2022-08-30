import { PROMISE_ABORTED } from "../../base/BaseConnection";
import { BoxTextEncoding, TransportData } from "../../base/TransportData";
import { TransportDataUtil } from "../../base/TransportDataUtil";
import { OpResult } from "../../models/OpResult";
import { TransportOptions } from "../../models/TransportOptions";
import { ApiReturn } from "../../proto/ApiReturn";
import { BaseServiceType } from "../../proto/BaseServiceType";
import { ServiceProto } from "../../proto/ServiceProto";
import { ProtoInfo, TsrpcErrorType } from "../../proto/TransportDataSchema";
import { TsrpcError } from "../../proto/TsrpcError";
import { BaseClient, BaseClientOptions, defaultBaseClientOptions, PrivateBaseClientOptions } from "../BaseClient";
import { BaseHttpClientTransport } from "./BaseHttpClientTransport";

export class BaseHttpClient<ServiceType extends BaseServiceType> extends BaseClient<ServiceType> {

    declare readonly options: BaseHttpClientOptions;
    protected _request: BaseHttpClientTransport['request'];

    constructor(serviceProto: ServiceProto<ServiceType>, options: BaseHttpClientOptions, privateOptions: PrivateBaseHttpClientOptions) {
        super(serviceProto, options, privateOptions);
        this._request = privateOptions.transport['request'];
        this.logger.log(`TSRPC HTTP Client: ${this.options.server}`);
    }

    protected async _sendData(data: string | Uint8Array, transportData: TransportData, options?: TransportOptions): Promise<OpResult<void>> {
        // Send to this URL
        const serviceName = 'serviceName' in transportData ? transportData.serviceName : '';
        const url = (typeof data === 'string' && serviceName)
            ? `${this.options.server}${this.options.server.endsWith('/') ? '' : '/'}${serviceName}`
            : this.options.server;

        // Do Send
        let { promise, abort } = this._request({
            url: url,
            data: data,
            method: 'POST',
            timeout: options?.timeout || this.options.callApiTimeout,
            headers: {
                'Content-Type': typeof data === 'string' ? 'application/json' : 'application/octet-stream',
                ...(transportData.type === 'msg' || transportData.type === 'custom' ? {
                    'X-TSRPC-DATA-TYPE': transportData.type,
                } : undefined),
                ...('protoInfo' in transportData && transportData.protoInfo ? {
                    'X-TSRPC-PROTO-INFO': JSON.stringify(transportData.protoInfo)
                } : undefined)
            },
            responseType: typeof data === 'string' ? 'text' : 'arraybuffer',
        });

        const pendingCallApiItem = transportData.type === 'req' ? this._pendingCallApis.get(transportData.sn) : undefined;
        if (pendingCallApiItem) {
            pendingCallApiItem.onAbort = () => {
                abort();
            }
            // Aborted
            if (pendingCallApiItem.isAborted) {
                return PROMISE_ABORTED;
            }
        }

        // callApi: recv data
        if (pendingCallApiItem) {
            promise.catch((e: Error) => ({ isSucc: false as const, err: new TsrpcError(e.message, { type: TsrpcErrorType.LocalError }) })).then(ret => {
                if (!ret.isSucc) {
                    this._recvApiReturn({
                        type: 'err',
                        sn: (transportData as TransportData & { type: 'req' }).sn,
                        err: ret.err
                    });
                    return;
                }

                this._recvData(ret.body, (transportData as TransportData & { type: 'req' }).sn, ret.headers);
            })
        }

        // Send Succ
        return { isSucc: true, res: undefined };
    }

    // #region Override text encode options
    declare protected _recvData: (data: string | Uint8Array, reqSn: number, resHeaders: Record<string, string> | undefined) => Promise<void>;

    protected _encodeJsonStr: ((jsonObj: any, schemaId: string) => string) = (obj, schemaId) => {
        return (this.options.encodeReturnText ?? JSON.stringify)(obj);
    }

    protected _encodeSkipSN = true;

    protected _encodeBoxText: (typeof TransportDataUtil)['encodeBoxText'] = (box: BoxTextEncoding & { type: 'req' }, skipSN) => {
        return { isSucc: true, res: box.body };
    }

    protected _decodeBoxText: (typeof TransportDataUtil)['decodeBoxText'] = (data, pendingCallApis, skipValidate, reqSn: number, resHeaders: Record<string, string> | undefined) => {
        const pendingApi = pendingCallApis.get(reqSn);
        if (!pendingApi) {
            return { isSucc: false, errMsg: `Invalid SN: ${reqSn}` };
        }

        // Parse body
        let body: object;
        try {
            body = (this.options.decodeReturnText ?? JSON.parse)(data);
        }
        catch (e) {
            return { isSucc: false, errMsg: `Response body is not a valid JSON.${this.flows.preRecvDataFlow.nodes.length ? ' You are using "preRecvDataFlow", please check whether it transformed the data properly.' : ''}\n  |- ${e}` }
        }

        // Parse remote proto info from header
        let protoInfo: ProtoInfo | undefined;
        if (resHeaders?.['X-TSRPC-PROTO-INFO']) {
            try {
                protoInfo = JSON.parse(resHeaders['X-TSRPC-PROTO-INFO'])
            }
            catch (e) {
                this.logger.warn('Invalid reponse header "X-TSRPC-PROTO-INFO":', resHeaders['X-TSRPC-PROTO-INFO'], e)
            }
        }

        return {
            isSucc: true,
            res: {
                type: 'res',
                body: body,
                serviceName: pendingApi.apiName,
                sn: reqSn,
                protoInfo: protoInfo
            }
        }
    }
    // #endregion

    // #region HTTP not supported APIs
    /** HTTP client do not support duplex callApi */
    declare implementApi: never;
    /** HTTP client not support listen Msg, please use `WsClient` instead. */
    declare onMsg: never;
    /** HTTP client not support listen Msg, please use `WsClient` instead. */
    declare offMsg: never;
    /** HTTP client not support listen Msg, please use `WsClient` instead. */
    declare listenMsg: never;
    /** HTTP client not support listen Msg, please use `WsClient` instead. */
    declare unlistenMsg: never;
    // #endregion

}

export const defaultBaseHttpClientOptions: BaseHttpClientOptions = {
    ...defaultBaseClientOptions,
    server: 'http://127.0.0.1:3000',
    heartbeat: false,
    apiCallTimeout: undefined as never
}

export interface BaseHttpClientOptions extends BaseClientOptions {
    /** Server URL, starts with `http://` or `https://`. */
    server: string;

    encodeReturnText?: (ret: ApiReturn<any>) => string,
    decodeReturnText?: (data: string) => ApiReturn<any>,

    /** HTTP do not need heartbeat */
    heartbeat: false,

    /** HTTP client do not support duplex callApi */
    apiCallTimeout: never
}

export interface PrivateBaseHttpClientOptions extends PrivateBaseClientOptions {
    transport: BaseHttpClientTransport
}

