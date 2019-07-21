import WebSocket from 'ws';
import { ApiError } from '../../proto/TransportData';
import { ServiceProto } from '../../proto/ServiceProto';
import { HandlerManager } from '../../models/HandlerManager';
import { BaseServiceType } from '../../proto/BaseServiceType';
import { CallApiOptions } from '../models/TransportOptions';
import { Counter } from '../../models/Counter';
import { TransportDataUtil, ParsedServerOutput } from '../../models/TransportDataUtil';
import { TSBuffer } from 'tsbuffer';
import { ServiceMap, ServiceMapUtil } from '../../models/ServiceMapUtil';
import { Logger } from '../../server/Logger';

export class WebSocketClient<ServiceType extends BaseServiceType = any> {

    private _options: WsClientOptions;
    private _tsbuffer: TSBuffer;
    private _serviceMap: ServiceMap;
    logger: Logger;

    private _ws?: WebSocket;
    private _msgHandlers: HandlerManager = new HandlerManager();
    private _apiReqSnCounter = new Counter(1);

    constructor(options: Pick<WsClientOptions, 'server' | 'proto'> & Partial<WsClientOptions>) {
        this._options = Object.assign({}, defaultClientOptions, options);
        this._tsbuffer = new TSBuffer(this._options.proto.types);
        this._serviceMap = ServiceMapUtil.getServiceMap(this._options.proto);
        this.logger = this._options.logger;
    }

    private _connecting?: Promise<void>;
    async connect() {
        // 已连接中
        if (this._connecting) {
            return this._connecting;
        }

        // 已连接成功
        if (this._ws) {
            return;
        }

        this._options.onStatusChange && this._options.onStatusChange('connecting');

        let ws = new (WebSocket as any)(this._options.server) as WebSocket;
        this._connecting = new Promise((rs: Function, rj?: Function) => {
            ws.onopen = () => {
                this._connecting = undefined;
                rs();
                this._options.onStatusChange && this._options.onStatusChange('open');
                rj = undefined;
                ws.onopen = undefined as any;
                this._ws = ws;
            };

            ws.onclose = e => {
                // 还在连接中，则连接失败
                if (rj) {
                    this._connecting = undefined;
                    rj();
                }

                // 清空WebSocket Listener
                ws.onopen = ws.onclose = ws.onmessage = ws.onerror = undefined as any;
                this._ws = undefined;

                this._options.onStatusChange && this._options.onStatusChange('closed');

                if (this._rsDisconnecting) {
                    this._rsDisconnecting();
                    this._rsDisconnecting = undefined;
                }
                // 非主动关闭 触发掉线
                else {
                    this._options.onLostConnection && this._options.onLostConnection();
                }
            };
        })

        ws.onerror = e => {
            this.logger.error('[WebSocket ERROR]', e.message);
        }

        ws.onmessage = e => {
            if (e.data instanceof Buffer) {
                this._onBuffer(e.data)
            }
            else if (e.data instanceof ArrayBuffer) {
                this._onBuffer(new Uint8Array(e.data));
            }
            else {
                this.logger.log('[UNRESOLVED_DATA]', e.data)
            }
        }

        return this._connecting;
    }

    private _rsDisconnecting?: () => void;
    async disconnect() {
        // 连接不存在
        if (!this._ws) {
            return;
        }

        return new Promise(rs => {
            this._rsDisconnecting = rs;
            this._ws!.close();
        })
    }

    private _onBuffer(buf: Uint8Array) {
        let parsed: ParsedServerOutput;
        try {
            parsed = TransportDataUtil.parseServerOutout(this._tsbuffer, this._serviceMap, buf);
        }
        catch (e) {
            this.logger.error('Cannot resolve buffer:', buf);
            return;
        }

        if (parsed.type === 'api') {
            let pending = this._pendingApi[parsed.sn];
            if (pending) {
                delete this._pendingApi[parsed.sn];
                if (parsed.isSucc) {
                    pending.rs(parsed.res);
                }
                else {
                    pending.rj(parsed.error);
                }
            }
            else {
                this.logger.warn(`Invalid SN:`, `Invalid SN: ${parsed.sn}`);
            }
        }
        else if (parsed.type === 'msg') {
            if (!this._msgHandlers.forEachHandler(parsed.service.name, parsed.msg)) {
                this.logger.debug('Unhandled msg:', parsed.msg)
            }
        }
    }

    private _pendingApi: {
        [sn: number]: { rs: (data: any) => void, rj: (err: any) => void } | undefined;
    } = {};
    async callApi<T extends keyof ServiceType['req']>(apiName: T, req: ServiceType['req'][T], options: CallApiOptions = {})
        : Promise<ServiceType['res'][T]> {
        if (!this._ws) {
            throw new Error('Not connected')
        }

        // GetService
        let service = this._serviceMap.apiName2Service[apiName as string];
        if (!service) {
            throw new Error('Invalid api name: ' + apiName);
        }

        // Send Req
        let sn = this._apiReqSnCounter.getNext();
        let buf = TransportDataUtil.encodeApiReq(this._tsbuffer, service, req, sn);
        this._ws.send(buf);

        // Wait Res
        let promise = new Promise<ServiceType['res'][T]>((rs, rj) => {
            this._pendingApi[sn] = {
                rs: rs,
                rj: rj
            }
        });
        promise.then(() => {
            if (timeoutTimer) {
                clearTimeout(timeoutTimer);
                timeoutTimer = undefined;
            }

            delete this._pendingApi[sn];
        }).catch(() => {
            if (timeoutTimer) {
                clearTimeout(timeoutTimer);
                timeoutTimer = undefined;
            }

            delete this._pendingApi[sn];
        });

        // Timeout
        let timeout = options.timeout !== undefined ? options.timeout : this._options.timeout;
        let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
        if (timeout > 0) {
            timeoutTimer = setTimeout(() => {
                timeoutTimer = undefined;
                if (this._pendingApi[sn]) {
                    let err: ApiError = {
                        message: 'Request timeout',
                        info: 'TIMEOUT'
                    }
                    this._pendingApi[sn]!.rj(err);
                }
            }, timeout);
        }

        return promise;
    }

    get status(): WsClientStatus {
        if (!this._ws || this._ws.readyState === WebSocket.CLOSED || this._ws.readyState === WebSocket.CLOSING) {
            return 'closed';
        }
        else if (this._ws.readyState === WebSocket.OPEN) {
            return 'open';
        }
        else {
            return 'connecting'
        }
    }

    listenMsg<T extends keyof ServiceType['msg']>(msgName: T, handler: ClientMsgHandler<ServiceType['msg'][T]>) {
        this._msgHandlers.addHandler(msgName as string, handler)
    }
    unlistenMsg<T extends keyof ServiceType['msg']>(msgName: T, handler?: ClientMsgHandler<ServiceType['msg'][T]>) {
        this._msgHandlers.removeHandler(msgName as string, handler)
    }

    sendMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T]) {
        if (!this._ws) {
            throw new Error('Not connected')
        }

        // GetService
        let service = this._serviceMap.msgName2Service[msgName as string];
        if (!service) {
            throw new Error('Invalid msg name: ' + msgName)
        }

        // Encode
        let buf = TransportDataUtil.encodeMsg(this._tsbuffer, service, msg);

        // Send Data
        return new Promise((rs, rj) => {
            this._ws!.send(buf, e => {
                e ? rj(e) : rs();
            })
        })
    }
}

const defaultClientOptions: WsClientOptions = {
    server: 'Server URL not set',
    proto: { services: [], types: {} },
    logger: console,
    timeout: 3000
}

export interface WsClientOptions {
    server: string;
    proto: ServiceProto;
    logger: Logger;
    timeout: number;

    onStatusChange?: (newStatus: WsClientStatus) => void;
    /** 掉线 */
    onLostConnection?: () => void;
}

export type WsClientStatus = 'open' | 'connecting' | 'closed';

export type ClientMsgHandler<Msg> = (msg: Msg) => void | Promise<void>;