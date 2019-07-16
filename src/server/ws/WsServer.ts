import { ServiceProto, ApiServiceDef, MsgServiceDef } from '../../proto/ServiceProto';
import * as WebSocket from 'ws';
import { Server as WebSocketServer } from 'ws';
import * as http from "http";
import { WsConnection } from './WSConnection';
import { TSBuffer } from 'tsbuffer';
import * as fs from "fs";
import * as path from "path";
import { Counter } from '../../models/Counter';
import { Logger } from '../Logger';
import { BaseServiceType } from '../../proto/BaseServiceType';
import { ServiceMap } from '../../models/ServiceMapUtil';
import { BaseServer, BaseServerOptions } from '../BaseServer';
import { WsCall } from './WsCall';
import { HttpUtil } from '../../models/HttpUtil';

export class WsServer<ServiceType extends BaseServiceType = any, SessionType = any> extends BaseServer<WsServerOptions<ServiceType, SessionType>, ServiceType> {

    private readonly _conns: WsConnection<ServiceType, SessionType>[] = [];
    private readonly _id2Conn: { [connId: string]: WsConnection<ServiceType, SessionType> | undefined } = {};

    private _connIdCounter = new Counter();

    private _status: WsServerStatus = 'closed';
    public get status(): WsServerStatus {
        return this._status;
    }

    private _wsServer?: WebSocketServer;
    start(): Promise<void> {
        if (this._wsServer) {
            throw new Error('Server already started');
        }

        this._status = 'opening';
        return new Promise(rs => {
            this.logger.log('Starting WebSocket server...');
            this._wsServer = new WebSocketServer({
                port: this._options.port
            }, () => {
                this.logger.log(`Server started at ${this._options.port}...`);
                this._status = 'open';
                rs();
            });

            this._wsServer.on('connection', this._onClientConnect);
            this._wsServer.on('error', e => {
                this.logger.error('[Server Error]', e);
            });
        })
    }

    private _stopping?: {
        rs: () => void,
        rj: (e: any) => void;
    }
    async stop(immediately: boolean = false): Promise<void> {
        if (!this._wsServer || this._status === 'closed') {
            return;
        }

        this._status = 'closing';
        let output = new Promise<void>(async (rs, rj) => {
            if (!this._wsServer) {
                throw new Error('Server has not been started')
            }

            if (immediately) {
                this._wsServer.close(() => { rs(); })
            }
            else {
                // 优雅地停止
                this._stopping = {
                    rs: rs,
                    rj: rj
                }
                if (this._conns.length) {
                    for (let conn of this._conns) {
                        conn.close();
                    }
                }
                else {
                    this._wsServer && this._wsServer.close(e => {
                        this._stopping = undefined;
                        this._status = 'closed';
                        e ? rj(e) : rs();
                    });
                }
            }
        });

        output.then(() => {
            this.logger.log('[SRV_STOP] Server stopped');
            this._status = 'closed';
            this._wsServer = undefined;
        })

        return output;
    }

    protected _makeCall(conn: WsConnection<ServiceType, SessionType>, buf: Uint8Array): WsCall {
        throw new Error('TODO')
    }

    // ConnID 1 ~ Number.MAX_SAFE_INTEGER
    getNextConnId(): number {
        // 最多尝试1万次
        for (let i = 0; i < 10000; ++i) {
            let connId = this._connIdCounter.getNext();
            if (!this._id2Conn[connId]) {
                return connId;
            }
        }

        this.logger.error('No available connId till ' + this._connIdCounter.last);
        return NaN;
    }

    private _onClientConnect = (ws: WebSocket, httpReq: http.IncomingMessage) => {
        // 停止中 不再接受新的连接
        if (this._stopping) {
            ws.close();
            return;
        }

        let connId = this.getNextConnId()
        if (isNaN(connId)) {
            ws.close();
            return;
        }

        // Create Active Connection
        let conn = WsConnection.pool.get({
            connId: connId,
            server: this,
            ws: ws,
            httpReq: httpReq,
            defaultSession: this._options.defaultSession,
            tsbuffer: this.tsbuffer,
            serviceMap: this.serviceMap,
            onClose: this._onClientClose,
            onRecvData: v => { this.onData(conn, v) }
        });
        this._conns.push(conn);
        this._id2Conn[conn.connId] = conn;

        this.logger.log('[CLIENT_CONNECT]', `IP=${conn.ip}`, `ConnID=${conn.connId}`, `ActiveConn=${this._conns.length}`);
    };

    

    private _onClientClose = (conn: WsConnection<ServiceType, SessionType>, code: number, reason: string) => {
        this._conns.removeOne(v => v.connId === conn.connId);
        this._id2Conn[conn.connId] = undefined;
        this.logger.log('[CLIENT_CLOSE]', `IP=${conn.ip} ConnID=${conn.connId} Code=${code} ${reason ? `Reason=${reason} ` : ''}ActiveConn=${this._conns.length}`);

        // 优雅地停止
        if (this._stopping && this._conns.length === 0) {
            this._wsServer && this._wsServer.close(e => {
                this._stopping = undefined;
                this._status = 'closed';
                e ? this._stopping!.rj(e) : this._stopping!.rs();
            });
        }
    }

    private async _handleApi(conn: ActiveConnection<ServiceType>, service: ApiServiceDef, sn: number, reqBody: any) {
        // Create ApiCall
        let call: ApiCall<any, any> = {
            service: service,
            sn: sn,
            conn: conn,
            data: reqBody,
            logger: new Logger(() => [`API#${sn}`, service.name], conn.logger),
            getSession: async () => conn.session,
            succ: (resBody) => {
                conn.sendApiSucc(call, resBody);
            },
            error: (message, info) => {
                conn.sendApiError(call, message, info);
            }
        }

        call.logger.log('Req', call.data);

        // ApiFlow
        for (let i = 0; i < this.apiFlow.length; ++i) {
            try {
                let res = this.apiFlow[i](call);
                if (res instanceof Promise) {
                    res = await res;
                }

                // Return true 表示继续后续流程 否则表示立即中止
                if (!res) {
                    return;
                }
            }
            // 一旦有异常抛出 立即中止处理流程
            catch (e) {
                call.logger.error('[API_FLOW_ERR]', `apiFlowIndex=${i}`, e);
                if (e instanceof TsrpcError) {
                    call.error(e.message, e.info);
                }
                else {
                    call.error('Internal server error', 'INTERNAL_ERR');
                }
                return;
            }
        }

        // ApiHandler
        let handler = this._apiHandlers[service.name];
        if (handler) {
            try {
                let res = handler(call);
                if (res instanceof Promise) {
                    await res;
                }
            }
            catch (e) {
                call.logger.error('[API_HANDLER_ERR]', e);
                if (e instanceof TsrpcError) {
                    call.error(e.message, e.info);
                }
                else {
                    call.error('Internal server error', 'INTERNAL_ERR');
                }
            }
        }
        // 未找到ApiHandler，且未进行任何输出
        else if (!call.output) {
            call.error('Unhandled API', 'UNHANDLED_API')
        }
    }

    private async _handleMsg(conn: ActiveConnection<ServiceType>, service: MsgServiceDef, msgBody: any) {
        // Create MsgCall
        let call: MsgCall = {
            conn: conn,
            service: service,
            data: msgBody,
            getSession: async () => conn.session,
            logger: new Logger(() => ['MSG', service.name], conn.logger)
        }

        // MsgFlow
        for (let i = 0; i < this.msgFlow.length; ++i) {
            try {
                let res = this.msgFlow[i](call);
                if (res instanceof Promise) {
                    res = await res;
                }
                // Return true 表示继续后续流程 否则表示立即中止
                if (!res) {
                    return;
                }
            }
            // 一旦有异常抛出 立即中止处理流程
            catch (e) {
                call.logger.error('[MSG_FLOW_ERR]', `msgFlowIndex=${i}`, e);
                return;
            }
        }

        // MsgHandler
        if (!this._msgHandlers.forEachHandler(service.name, call)) {
            this.logger.debug('[UNHANDLED_MSG]', service.name);
        }
    }

    // API 只能实现一次
    implementApi<T extends keyof ServiceType['req']>(apiName: T, handler: ApiHandler<ServiceType['req'][T], ServiceType['res'][T], ServiceType>) {
        if (this._apiHandlers[apiName as string]) {
            throw new Error('Already exist handler for API: ' + apiName);
        }
        this._apiHandlers[apiName as string] = handler;
    };

    // Msg 可以重复监听
    listenMsg<T extends keyof ServiceType['msg']>(msgName: T, handler: MsgHandler<ServiceType['msg'][T], ServiceType>) {
        this._msgHandlers.addHandler(msgName as string, handler);
    };

    unlistenMsg<T extends keyof ServiceType['msg']>(msgName: T, handler?: MsgHandler<ServiceType['msg'][T], ServiceType>) {
        this._msgHandlers.removeHandler(msgName as string, handler);
    };

    // Send Msg
    async sendMsg<T extends keyof ServiceType['msg']>(connIds: string[], msgName: T, msg: ServiceType['msg'][T]): Promise<void> {
        if (this.status !== 'open') {
            this.logger.error('Server not open, sendMsg failed');
            return;
        }

        // GetService
        let service = this._serviceMap.msgName2Service[msgName as string];
        if (!service) {
            throw new Error('Invalid msg name: ' + msgName)
        }

        // Encode
        let buf = this._tsbuffer.encode(msg, service.msg);

        // Send Data
        let data: ServerOutputData = [service.id, buf];
        let transportData = Transporter.transportCoder.encode(data, 'ServerOutputData');

        await Promise.all(connIds.map(v => {
            let conn = this._id2Conn[v];
            if (conn) {
                conn.sendRaw(transportData)
            }
            else {
                this.logger.error('SendMsg failed, invalid connId: ' + v)
            }
        }))
    };

    private _autoImplementApis(apiPath: string): { succ: string[], fail: string[] } {
        let apiServices = Object.values(this._serviceMap.apiName2Service) as ApiServiceDef[];
        let output: { succ: string[], fail: string[] } = { succ: [], fail: [] };

        for (let svc of apiServices) {
            //get matched Api
            let apiHandler: Function | undefined;

            // get api last name
            let match = svc.name.match(/^(.+\/)*(.+)$/);
            if (!match) {
                this.logger.warn('Invalid apiName: ' + svc.name);
                output.fail.push(svc.name);
                continue;
            }
            let handlerPath = match[1] || '';
            let handlerName = match[2];

            // try import
            try {
                let module = require(path.resolve(apiPath, handlerPath, 'Api' + handlerName));
                // 优先ApiName同名 否则使用default
                apiHandler = module['Api' + handlerName] || module['default'];
            }
            catch{ }

            if (!apiHandler) {
                output.fail.push(svc.name);
                this.logger.warn('Auto implement api fail: ' + svc.name);
                continue;
            }

            this.implementApi(svc.name, apiHandler as any);
            this.logger.log('Auto implement api succ: ' + svc.name);
            output.succ.push(svc.name);
        }

        return output;
    }
}

export type WsServerStatus = 'opening' | 'open' | 'closing' | 'closed';

const defaultServerOptions: WsServerOptions<any, any> = {
    port: 3000,
    logger: console,
    proto: {
        services: [],
        types: {}
    },
    defaultSession: {}
}

// event => event data
export interface ServerEventData {
    sendMsg: any,
    resSucc: any,
    resError: any
}

export interface WsServerOptions<ServiceType extends BaseServiceType, SessionType> extends BaseServerOptions {
    port: number;
    defaultSession: SessionType;
};


// Flow：return true 代表继续flow，否则为立即中止
export type ApiFlowItem<
    Req = any,
    Res = any,
    ServiceType extends BaseServiceType = any
    > = (call: ApiCall<Req, Res, ServiceType>) => boolean | Promise<boolean>;
export type MsgFlowItem<
    Msg = any,
    ServiceType extends BaseServiceType = any
    > = (msg: MsgCall<Msg, ServiceType>) => boolean | Promise<boolean>;