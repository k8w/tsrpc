import WebSocket from 'ws';
import { ApiError } from '../proto/TransportData';
import { ServiceProto } from '../proto/ServiceProto';
import { Transporter, RecvData } from '../models/Transporter';
import { HandlerManager } from '../models/HandlerManager';

export interface BaseClientCustomType {
    req: any,
    res: any,
    msg: any
}

export class WebSocketClient<ClientCustomType extends BaseClientCustomType> {

    private readonly _options: ClientOptions;

    private _transporter: Transporter;
    private _ws?: WebSocket;
    private _msgHandlers: HandlerManager = new HandlerManager();

    constructor(options: Pick<ClientOptions, 'server' | 'proto'> & Partial<ClientOptions>) {
        this._options = Object.assign({}, defaultClientOptions, options);
        this._transporter = Transporter.getFromPool('client', {
            proto: this._options.proto,
            onRecvData: this._onRecvData
        });
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

        this._ws = new (WebSocket as any)(this._options.server) as WebSocket;
        this._connecting = new Promise((rs: Function, rj?: Function) => {
            this._ws!.onopen = () => {
                this._connecting = undefined;
                rs();
                this._options.onStatusChange && this._options.onStatusChange('open');
                rj = undefined;
                this._ws!.onopen = undefined as any;
                this._transporter.resetWs(this._ws!);
            };

            this._ws!.onclose = e => {
                // 还在连接中，则连接失败
                if (rj) {
                    this._connecting = undefined;
                    rj();
                }

                // 清空WebSocket Listener
                this._ws!.onopen = this._ws!.onclose = this._ws!.onmessage = this._ws!.onerror = undefined as any;
                this._ws = undefined;

                // 重设Transporter
                this._transporter.resetWs(undefined);

                this._options.onStatusChange && this._options.onStatusChange('closed');

                if (!this._disconnecting) {
                    this._options.onLostConnection && this._options.onLostConnection();
                }
                this._disconnecting = false;
            };
        })

        this._ws.onerror = e => {
            console.error('[WebSocket ERROR]', e.message);
        }

        return this._connecting;
    }

    private _disconnecting = false;
    disconnect() {
        // 连接不存在
        if (!this._ws) {
            return;
        }

        this._disconnecting = true;
        this._ws.close();
    }

    private _onRecvData = (recvData: RecvData) => {
        // 文字消息，通常用于调试，直接打印
        if (recvData.type === 'text') {
            console.debug('Received Text:', recvData.data);
        }
        else if (recvData.type === 'apiRes') {
            let pending = this._pendingApi[recvData.sn];
            if (pending) {
                delete this._pendingApi[recvData.sn];
                (recvData.isSucc ? pending.rs : pending.rj)(recvData.data);
            }
            else {
                console.warn(`Invalid SN:`, `Invalid SN: ${recvData.sn}`);
            }
        }
        else if (recvData.type === 'msg') {
            if (!this._msgHandlers.forEachHandler(recvData.service.name, recvData.data)) {
                console.debug('Unhandled msg:', recvData.data)
            }
        }
        else {
            console.warn('Unresolved buffer:', recvData.data)
        }
    }

    private _pendingApi: {
        [sn: number]: { rs: (data: any) => void, rj: (err: any) => void } | undefined;
    } = {};
    async callApi<T extends keyof ClientCustomType['req']>(apiName: T, req: ClientCustomType['req'][T], options: CallApiOptions = {})
        : Promise<ClientCustomType['res'][T]> {
        // Send Req
        let sn = this._transporter.sendApiReq(apiName as string, req);

        // Wait Res
        let promise = new Promise<ClientCustomType['res'][T]>((rs, rj) => {
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
        let timeout = options.timeout !== undefined ? options.timeout : this._options.apiTimeout;
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
            }, timeout * 1000);
        }

        return promise;
    }

    get status(): ClientStatus {
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

    listenMsg<T extends keyof ClientCustomType['msg']>(msgName: T, handler: ClientMsgHandler<ClientCustomType['msg'][T]>) {
        this._msgHandlers.addHandler(msgName as string, handler)
    }
    unlistenMsg<T extends keyof ClientCustomType['msg']>(msgName: T, handler?: ClientMsgHandler<ClientCustomType['msg'][T]>) {
        this._msgHandlers.removeHandler(msgName as string, handler)
    }

    sendMsg<T extends keyof ClientCustomType['msg']>(msgName: T, msg: ClientCustomType['msg'][T]) {
        return this._transporter.sendMsg(msgName as string, msg);
    }
}

const defaultClientOptions: ClientOptions = {
    server: '',
    proto: undefined as any,
    // 默认超时30秒
    apiTimeout: 30
}

export interface ClientOptions {
    server: string;
    proto: ServiceProto;
    apiTimeout: number;

    onStatusChange?: (newStatus: ClientStatus) => void;
    /** 掉线 */
    onLostConnection?: () => void;
}

export type ClientStatus = 'open' | 'connecting' | 'closed';

export type ClientMsgHandler<Msg> = (msg: Msg) => void | Promise<void>;

export interface CallApiOptions {
    /** 超时时间（单位：秒） */
    timeout?: number;
}