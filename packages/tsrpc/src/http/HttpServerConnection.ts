import { IncomingMessage, ServerResponse } from 'http';
import { ApiCall, ApiReturn, ApiService, BaseConnection, BaseServiceType, BoxTextDecoding, BoxTextEncoding, MsgService, OpResult, OpResultVoid, ProtoInfo, TransportData, TransportDataUtil, TransportOptions, TsrpcError, TsrpcErrorType } from "tsrpc-base";
import { BaseServerConnection, ServerStatus } from "tsrpc-base-server";
import { TSRPC_VERSION } from '../models/version';
import { HttpServer } from './HttpServer';
import { HttpUtil } from './models/HttpUtil';

export class HttpServerConnection<ServiceType extends BaseServiceType = any> extends BaseServerConnection<ServiceType> {
    readonly httpReq: IncomingMessage & { rawBody?: Buffer };
    readonly httpRes: ServerResponse;
    call?: ApiCall;
    transportData?: TransportData;

    constructor(public readonly server: HttpServer<ServiceType>, privateOptions: PrivateHttpServerConnectionOptions) {
        const ip = HttpUtil.getClientIp(privateOptions.httpReq);
        super(server, {
            // 默认 buffer，收完数据后，preRecvDataFlow 后根据 header 解析
            dataType: 'buffer',
            ip: ip,
            logPrefixs: [server.chalk(`[${ip}]`, ['gray'])]
        });
        const req = this.httpReq = privateOptions.httpReq;
        const res = this.httpRes = privateOptions.httpRes;

        // Header
        this.httpRes.statusCode = 200;
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
            this.httpReq.rawBody = buf;
            const data = this.dataType === 'buffer' ? buf : buf.toString();
            this._recvData(data);
        });

        // 处理连接异常关闭的情况
        res.on('close', async () => {
            let isManual: boolean;
            let reason: string | undefined;

            // 异常断开：客户端 Abort
            if (req.destroyed ?? req.aborted) {
                (this.call?.logger ?? this.logger).debug(this.chalk('[ReqAborted]', ['debug']));
                isManual = false;
                reason = 'Remote aborted';
            }
            // 异常断开：Client 未正常 end
            else if (!this.httpReq.readableEnded) {
                this.logger.warn('Socket closed before request end normally', {
                    url: this.httpReq.url,
                    method: this.httpReq.method,
                    ip: this.ip,
                    chunksLength: chunks.length,
                    chunksSize: chunks.sum(v => v.byteLength),
                    reqComplete: this.httpReq.complete,
                    headers: this.httpReq.headers
                });
                isManual = false;
                reason = 'Socket closed before request end normally';
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

        if (this.server.status !== ServerStatus.Started) {
            this.httpRes.statusCode = 500;
            this.httpRes.end();
        }
    }

    protected async _sendData(data: string | Uint8Array, transportData: TransportData, options?: TransportOptions): Promise<OpResultVoid> {
        if (!this.httpRes.writable) {
            return { isSucc: false, errMsg: 'Response is not writable, you may sended response before.' };
        }

        return new Promise<OpResultVoid>(rs => {
            if (transportData.type === 'err' && transportData.err.type !== TsrpcErrorType.ApiError) {
                this.httpRes.statusCode = 500;
            }
            this.httpRes.setHeader('Content-Type', typeof data === 'string' ? 'application/json; charset=utf-8' : 'application/octet-stream');
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
        this.logger = call.logger;
        return call.execute();
    }

    protected override async _recvTransportData(transportData: TransportData): Promise<void> {
        this.transportData = transportData;
        if (transportData.type !== 'req' && transportData.type !== 'custom') {
            this.httpRes.end();
        }
        return super._recvTransportData(transportData);
    }

    // #region Override text encode options
    protected override _encodeSkipSN = true;

    protected override _encodeBoxText: (typeof TransportDataUtil)['encodeBoxText'] = (box: BoxTextEncoding & { type: 'req' }, skipSN) => {
        return { isSucc: true, res: box.body };
    }

    /**
     * HttpServerConnection would transport serviceName by URL, and transport protoInfo by headers.
     * So it isn't that every field of Box is stored in the HTTP body, so it need to customized the decode box text method.
     */
    protected override _decodeBoxText: (typeof TransportDataUtil)['decodeBoxText'] = (data, pendingCallApis, skipValidate) => {
        let op = this._doDecodeBoxText(data);
        if (!op.isSucc) {
            this._sendTransportData({
                type: 'err',
                err: new TsrpcError(op.errMsg, { type: TsrpcErrorType.RemoteError }),
                sn: this.id,
                protoInfo: this.server.localProtoInfo
            })
        }

        return op;
    }

    protected _doDecodeBoxText(data: string): OpResult<BoxTextDecoding> {
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
            service = this.serviceMap.name2Msg[serviceName];
        }
        else {
            service = this.serviceMap.name2LocalApi[serviceName]
        }
        if (service === undefined) {
            return {
                isSucc: false,
                errMsg: `Invalid ${isMsg ? 'msg' : 'api'} path: ${serviceName}`
            };
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
            if (this.flows.preRecvDataFlow.nodes.length) {
                this.logger.warn('Cannot parse the request data to JSON. You are using "preRecvDataFlow", please check whether it transformed the data properly.', e)
            }
            return {
                isSucc: false,
                errMsg: `Request body is not a valid JSON.`
            };
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

export interface PrivateHttpServerConnectionOptions {
    httpReq: IncomingMessage,
    httpRes: ServerResponse
}