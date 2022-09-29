import { IncomingMessage, ServerResponse } from 'http';
import { ApiCall, ApiReturn, ApiService, BaseConnection, BaseServiceType, BoxTextEncoding, MsgService, OpResultVoid, ProtoInfo, TransportData, TransportDataUtil, TransportOptions, TsrpcError, TsrpcErrorType } from "tsrpc-base";
import { BaseServerConnection, PrivateBaseServerConnectionOptions } from "tsrpc-base-server";
import { TSRPC_VERSION } from '../models/version';
import { HttpServer } from './HttpServer';

export class HttpServerConnection<ServiceType extends BaseServiceType = any> extends BaseServerConnection<ServiceType> {
    readonly httpReq: IncomingMessage;
    readonly httpRes: ServerResponse;
    call?: ApiCall;
    transportData?: TransportData;

    constructor(public readonly server: HttpServer<ServiceType>, privateOptions: PrivateHttpServerConnectionOptions) {
        super(server, privateOptions);
        const req = this.httpReq = privateOptions.httpReq;
        const res = this.httpRes = privateOptions.httpRes;

        // Header
        res.statusCode = 200;
        res.setHeader('X-Powered-By', `TSRPC ${TSRPC_VERSION}`);

        // CORS
        if (this.options.cors) {
            res.setHeader('Access-Control-Allow-Origin', this.options.cors);
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type,*');
            if (this.options.corsMaxAge) {
                res.setHeader('Access-Control-Max-Age', '' + this.options.corsMaxAge);
            }
        };
        if (req.method === 'OPTIONS') {
            res.end();
            return;
        }

        // Determine dataType
        const contentType = req.headers['content-type']?.toLowerCase();
        if (!contentType) {
            this.dataType = this.server.options.defaultDataType === 'text' && this.server.options.json ? 'text' : 'buffer';
        }
        else if (contentType.indexOf('application/json') > -1) {
            this.dataType = 'text';
        }

        // Wait data
        let chunks: Buffer[] = [];
        req.on('data', (data: Buffer) => {
            chunks.push(data);
        });
        req.on('end', async () => {
            const buf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
            const data = this.dataType === 'buffer' ? buf : buf.toString();
            this._recvData(data);
        });

        // 处理连接异常关闭的情况
        res.on('close', async () => {
            let isManual: boolean;
            let reason: string | undefined;

            // 异常断开：客户端 Abort
            if (req.aborted) {
                (this.call?.logger ?? this.logger).log('[ReqAborted]');
                isManual = false;
                reason = 'Remote aborted';
            }
            // 异常断开：Client 未正常 end
            else if (!this.httpReq.readableEnded) {
                this.logger.warn('Socket closed before request end', {
                    url: this.httpReq.url,
                    method: this.httpReq.method,
                    ip: this.ip,
                    chunksLength: chunks.length,
                    chunksSize: chunks.sum(v => v.byteLength),
                    reqComplete: this.httpReq.complete,
                    headers: this.httpReq.headers
                });
                isManual = false;
                reason = 'Socket closed before request end';
            }
            // 异常断开：直到连接关闭，也未调用过 httpRes.end 方法
            else if (!this.httpRes.writableEnded) {
                (this.call?.logger || this.logger).warn('Socket closed without any response');
                isManual = false;
                reason = 'Socket closed without any response';
            }
            // 正常断开
            else {
                isManual = true;
            }
            
            this._disconnect(isManual, reason);
        });
    }

    protected async _sendData(data: string | Uint8Array, transportData: TransportData, options?: TransportOptions): Promise<OpResultVoid> {
        return new Promise<OpResultVoid>(rs => {
            if (typeof data === 'string') {
                this.httpRes.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            this.httpRes.end(data, () => {
                rs({ isSucc: true })
            });
        }).catch((e: Error) => {
            this.logger.debug('_sendData error', e);
            return { isSucc: false, errMsg: e.message };
        })
    }

    protected override _recvApiReq(transportData: TransportData & { type: 'req' }): Promise<ApiReturn<any>> {
        // Make ApiCall
        const call = new ApiCall(this, transportData.serviceName, transportData.sn, transportData.body, transportData.protoInfo);
        this.call = call;
        return call.execute();
    }

    protected override async _recvTransportData(transportData: TransportData): Promise<OpResultVoid> {
        this.transportData = transportData;
        return super._recvTransportData(transportData);
    }

    // #region Override text encode options
    protected override _encodeSkipSN = true;

    protected override _encodeBoxText: (typeof TransportDataUtil)['encodeBoxText'] = (box: BoxTextEncoding & { type: 'req' }, skipSN) => {
        return { isSucc: true, res: box.body };
    }

    /**
     * HttpServerConnection would transport serviceName in URL, and transport protoInfo in headers.
     * So it isn't that every info is stored in the body, so it need to customized the decode box text method.
     */
    protected override _decodeBoxText: (typeof TransportDataUtil)['decodeBoxText'] = (data, pendingCallApis, skipValidate) => {
        const isMsg = this.httpReq.headers['x-tsrpc-data-type'] === 'msg';
        let url = this.httpReq.url!;
        const urlEndPos = url.indexOf('?');
        if (urlEndPos > -1) {
            url = url.slice(0, urlEndPos);
        }
        const sn = this.id;

        // Parse service
        let serviceName = url.slice(this.server.options.jsonHostPath.length);
        let service: ApiService | MsgService | undefined;
        if (isMsg) {
            service = this.serviceMap.msgName2Service[serviceName];
        }
        else {
            service = this.serviceMap.apiName2Service[serviceName]
        }
        if (service === undefined) {
            const errMsg = `Invalid ${isMsg ? 'msg' : 'api'} path: ${serviceName}`;
            this._sendTransportData({
                type: 'err',
                err: new TsrpcError(errMsg, { type: TsrpcErrorType.RemoteError }),
                sn: sn,
                protoInfo: this.server.localProtoInfo
            })
            return { isSucc: false, errMsg: errMsg };
        }

        // Parse protoInfo
        let protoInfo: ProtoInfo | undefined;
        const header = this.httpReq.headers['x-tsrpc-proto-info'];
        try {
            if (typeof header === 'string') {
                protoInfo = JSON.parse(header)
            }
        }
        catch (e) {
            this.logger.warn('Invalid request header "x-tsrpc-proto-info":', header, 'err:', e)
        }

        // body
        let body: object;
        try {
            body = JSON.parse(data);
        }
        catch (e) {
            const errMsg = `Request body is not a valid JSON.${this.flows.preRecvDataFlow.nodes.length ? ' You are using "preRecvDataFlow", please check whether it transformed the data properly.' : ''}\n  |- ${e}`;
            this._sendTransportData({
                type: 'err',
                err: new TsrpcError(errMsg, { type: TsrpcErrorType.RemoteError }),
                sn: sn,
                protoInfo: this.server.localProtoInfo
            })
            return { isSucc: false, errMsg: errMsg };
        }

        return {
            isSucc: true,
            res: {
                type: isMsg ? 'msg' : 'req',
                body: body,
                serviceName: service.name,
                sn: sn,
                protoInfo: protoInfo
            }
        }
    }

    /**
     * To make use of `HttpServerOptions.encodeReturnText`
     */
    protected override _stringifyBodyJson: BaseConnection['_stringifyBodyJson'] = bodyJson => {
        // bodyJson must be ApiReturn<any>
        return this.options.encodeReturnText ? this.options.encodeReturnText(bodyJson as ApiReturn<any>) : JSON.stringify(bodyJson);
    }
    // #endregion
}

export interface PrivateHttpServerConnectionOptions extends PrivateBaseServerConnectionOptions {
    httpReq: IncomingMessage,
    httpRes: ServerResponse,
}