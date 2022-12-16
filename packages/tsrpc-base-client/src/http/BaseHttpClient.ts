import { ApiReturn, BaseServiceType, BoxTextEncoding, ConnectionStatus, OpResult, OpResultVoid, PROMISE_ABORTED, ProtoInfo, ServiceProto, TransportData, TransportDataUtil, TransportOptions, TsrpcError, TsrpcErrorType } from "tsrpc-base";
import { BaseClient, BaseClientOptions, defaultBaseClientOptions, PrivateBaseClientOptions } from "../base/BaseClient";
import { HttpRequest } from "./HttpRequest";

export class BaseHttpClient<ServiceType extends BaseServiceType = any> extends BaseClient<ServiceType> {

    declare readonly options: BaseHttpClientOptions;
    protected _request: HttpRequest;

    constructor(serviceProto: ServiceProto<ServiceType>, options: BaseHttpClientOptions, privateOptions: PrivateBaseHttpClientOptions) {
        super(serviceProto, options, privateOptions);
        super._setStatus(ConnectionStatus.Connected);
        this._request = privateOptions.request;
        this.logger.log(`TSRPC HTTP Client: ${this.options.server}`);
    }

    protected async _sendData(data: string | Uint8Array, transportData: TransportData, options?: TransportOptions): Promise<OpResultVoid> {
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
                    'x-tsrpc-data-type': transportData.type,
                } : undefined),
                ...('protoInfo' in transportData && transportData.protoInfo ? {
                    'x-tsrpc-proto-info': JSON.stringify(transportData.protoInfo)
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
                        sn: pendingCallApiItem.sn,
                        err: ret.err
                    });
                    return;
                }

                // Only 200 or 500 is valid
                if (ret.statusCode !== 200 && ret.statusCode !== 500) {
                    this._recvApiReturn({
                        type: 'err',
                        sn: pendingCallApiItem.sn,
                        err: new TsrpcError({
                            message: 'HTTP Error ' + ret.statusCode,
                            type: TsrpcError.Type.ServerError,
                            httpCode: ret.statusCode
                        })
                    });
                    return;
                }

                // Parse remote proto info from header
                let protoInfo: ProtoInfo | undefined;
                if (ret.headers?.['x-tsrpc-proto-info']) {
                    try {
                        protoInfo = JSON.parse(ret.headers['x-tsrpc-proto-info'])
                    }
                    catch (e) {
                        this.logger.warn('Invalid reponse header "x-tsrpc-proto-info":', ret.headers['x-tsrpc-proto-info'], e)
                    }
                }

                this._recvData(ret.body, {
                    sn: pendingCallApiItem.sn,
                    ...(protoInfo ? { protoInfo: protoInfo } : undefined)
                });
            })
        }

        // Send Succ
        return { isSucc: true };
    }

    // #region Override text encode options
    declare protected _recvData: (data: string | Uint8Array, boxInfo: { sn: number, protoInfo?: ProtoInfo }) => Promise<OpResult<TransportData>>;

    protected override _encodeSkipSN = true;

    protected override _encodeBoxText: (typeof TransportDataUtil)['encodeBoxText'] = (box: BoxTextEncoding & { type: 'req' }, skipSN) => {
        return { isSucc: true, res: box.body };
    }

    protected override _decodeBoxText: (typeof TransportDataUtil)['decodeBoxText'] = (data, pendingCallApis, skipValidate, boxInfo: { sn: number, protoInfo: ProtoInfo }) => {
        const pendingApi = pendingCallApis.get(boxInfo.sn);
        if (!pendingApi) {
            return { isSucc: false, errMsg: `Invalid SN: ${boxInfo.sn}` };
        }

        // Parse body
        let body: ApiReturn<any>;
        try {
            // TODO decodeReturnText throw 的 TsrpcError 直接抛给前端
            // TODO 是合法的 JSON 但不是合法的 ApiReturn
            body = (this.options.decodeReturnText ?? JSON.parse)(data);
        }
        catch (e) {
            return { isSucc: false, errMsg: `Response body is not a valid JSON.${this.flows.preRecvDataFlow.nodes.length ? ' You are using "preRecvDataFlow", please check whether it transformed the data properly.' : ''}\n  |- ${e}` }
        }

        return {
            isSucc: true,
            res: {
                type: 'res',
                body: body,
                serviceName: pendingApi.apiName,
                sn: boxInfo.sn,
                protoInfo: boxInfo.protoInfo
            }
        }
    }
    // #endregion

    // #region HTTP not supported APIs
    /** @deprecated HTTP client does not have status */
    declare readonly status: never;
    /** @deprecated HTTP client do not support duplex callApi */
    declare implementApi: never;
    /** @deprecated HTTP client not support listen Msg, please use `WsClient` instead. */
    declare onMsg: never;
    /** @deprecated HTTP client not support listen Msg, please use `WsClient` instead. */
    declare offMsg: never;
    /** @deprecated HTTP client not support listen Msg, please use `WsClient` instead. */
    declare listenMsg: never;
    /** @deprecated HTTP client not support listen Msg, please use `WsClient` instead. */
    declare unlistenMsg: never;
    // #endregion

}

export const defaultBaseHttpClientOptions: BaseHttpClientOptions = {
    ...defaultBaseClientOptions,
    server: 'http://127.0.0.1:3000',
    heartbeat: false,
    logConnect: false,
    apiCallTimeout: undefined as never
}

export interface BaseHttpClientOptions extends BaseClientOptions {
    /** Server URL, starts with `http://` or `https://`. */
    server: string;

    /**
     * If you want to customize JSON return format, set this.
     * You should set `encodeReturnText` on the server side too.
     */
    decodeReturnText?: (data: string) => ApiReturn<any>,

    // Deprecated
    /** @deprecated HTTP client do not support duplex callApi */
    apiCallTimeout: never,
    /** @deprecated HTTP does not has connect info */
    logConnect: false,
    /** @deprecated HTTP does not need heartbeat */
    heartbeat: false,
}

export interface PrivateBaseHttpClientOptions extends PrivateBaseClientOptions {
    request: HttpRequest
}

