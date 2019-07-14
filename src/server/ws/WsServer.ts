import { ServiceProto, ApiServiceDef, MsgServiceDef } from '../proto/ServiceProto';
import * as WebSocket from 'ws';
import { Server as WebSocketServer } from 'ws';
import * as http from "http";
import { ActiveConnection } from './ws/WSConnection';
import { TSBuffer } from 'tsbuffer';
import * as fs from "fs";
import * as path from "path";
import { ApiCall, MsgCall } from './BaseCall';
import { Counter } from '../models/Counter';
import { Logger } from './Logger';
import { ServiceMap, Transporter, RecvData } from '../models/Transporter';
import { HandlerManager } from '../models/HandlerManager';
import { TsrpcError } from '../models/TsrpcError';
import { ServerOutputData } from '../proto/TransportData';

export interface BaseServerCustomType {
    req: any,
    res: any,
    msg: any,
    session: any
}

export class Server<ServerCustomType extends BaseServerCustomType = any> {

    // Flow return 代表是否继续执行后续流程
    readonly apiFlow: ApiFlowItem[] = [];
    readonly msgFlow: MsgFlowItem[] = [];

    private readonly _conns: ActiveConnection<ServerCustomType>[] = [];
    private readonly _id2Conn: { [connId: string]: ActiveConnection<ServerCustomType> | undefined } = {};

    // 配置及其衍生项
    private readonly _options: ServerOptions<ServerCustomType>;
    readonly proto: ServiceProto;
    private _tsbuffer: TSBuffer;
    private _serviceMap: ServiceMap;

    private _connIdCounter = new Counter();

    // Handlers
    private _apiHandlers: { [apiName: string]: ApiHandler | undefined } = {};
    // 多个Handler将异步并行执行
    private _msgHandlers = new HandlerManager;

    constructor(options: Pick<ServerOptions, 'proto'> & Partial<ServerOptions<ServerCustomType>>) {
        this._options = Object.assign({}, defaultServerOptions, options);

        if (typeof (this._options.proto) === 'string') {
            try {
                this.proto = JSON.parse(fs.readFileSync(this._options.proto).toString());
            }
            catch (e) {
                console.error(e);
                throw new Error('打开Proto文件失败: ' + path.resolve(this._options.proto));
            }
        }
        else {
            this.proto = this._options.proto;
        }

        this._tsbuffer = new TSBuffer(this.proto.types);
        this._serviceMap = Transporter.getServiceMap(this.proto);

        // 自动注册API
        if (options.apiPath) {
            console.log('Start auto implement apis...');
            let op = this._autoImplementApis(options.apiPath);
            console.log(`√ Finished: ${op.succ.length} succ, ${op.fail.length} fail`)
        }
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

        console.error('No available connId till ' + this._connIdCounter.last);
        return NaN;
    }

    /**
     * 启动服务
     * @param port 要监听的端口号，不填写则使用`ServerOptions`中的
     * @returns 成功监听的端口号
     */
    async start() {
        await Promise.all([
            this._options.wsPort && this._startWs(),
            this._options.httpPort && this._startHttp()
        ])
    }

    private _wsServer?: WebSocketServer;
    private async _startWs() {
        if (!this._options.wsPort) {
            console.warn('Start WS failed: wsPort is undefined');
            return;
        }

        if (this._wsServer) {
            console.warn('Server has been started already');
            return;
        }

        this._status = 'opening';
        return new Promise(rs => {
            this._wsServer = new WebSocketServer({
                port: this._options.wsPort
            }, () => {
                console.log(`[WS_START] WebSocket server started at ${this._options.wsPort}...`);
                this._status = 'open';
                rs(this._options.wsPort!);
            });

            this._wsServer.on('connection', this._onClientConnect);
            this._wsServer.on('error', e => {
                console.error('[SVR_ERR]', e);
            });
        })
    }

    private _httpServer?: http.Server;
    private async _startHttp() {
        if (!this._options.httpPort) {
            console.warn('Start Http failed: httpPort is undefined');
            return;
        }

        return new Promise((rs, rj) => {
            this._httpServer = http.createServer((req, res) => {
                // TEST
                res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });

                req.on('data', v => {
                    console.log('onData', v);
                    res.write('Hello, ' + v);
                    res.end();
                });
            });
            this._httpServer.listen(this._options.httpPort, () => {
                console.log(`[Http_START] Http server started at ${this._options.httpPort}...`)
                rs()
            });
        })
    }

    private _onClientConnect = (ws: WebSocket, req: http.IncomingMessage) => {
        // 停止中 不再接受新的连接
        if (this._rsStopping) {
            ws.close();
            return;
        }

        let connId = this.getNextConnId()
        if (isNaN(connId)) {
            ws.close();
            return;
        }

        // Create Active Connection
        let conn = ActiveConnection.getFromPool({
            connId: connId,
            server: this,
            ws: ws,
            request: req,
            session: this._options.defaultSession,
            tsbuffer: this._tsbuffer,
            serviceMap: this._serviceMap,
            onClose: this._onClientClose,
            onRecvData: this._onRecvData
        });
        this._conns.push(conn);
        this._id2Conn[conn.connId] = conn;

        console.log('[CLIENT_CONNECT]', `IP=${conn.ip}`, `ConnID=${conn.connId}`, `ActiveConn=${this._conns.length}`);
    };

    private _onRecvData = (conn: ActiveConnection<ServerCustomType>, recvData: RecvData) => {
        if (recvData.type === 'text') {
            console.debug('[RECV_TXT]', recvData.data);
            if (recvData.data === 'status') {
                conn.sendRaw(`Status=${this.status}, ActiveConn=${this._conns.length}`)
            }
        }
        else if (recvData.type === 'apiReq') {
            this._handleApi(conn, recvData.service, recvData.sn, recvData.data);
        }
        else if (recvData.type === 'msg') {
            this._handleMsg(conn, recvData.service, recvData.data);
        }
        else {
            console.warn('[UNRESOLVED_BUFFER]', recvData.data);
        }
    }

    private _onClientClose = (conn: ActiveConnection<ServerCustomType>, code: number, reason: string) => {
        this._conns.removeOne(v => v.connId === conn.connId);
        this._id2Conn[conn.connId] = undefined;
        ActiveConnection.putIntoPool(conn);
        console.log('[CLIENT_CLOSE]', `IP=${conn.ip} ConnID=${conn.connId} Code=${code} ${reason ? `Reason=${reason} ` : ''}ActiveConn=${this._conns.length}`);

        // 优雅地停止
        if (this._rsStopping && this._conns.length === 0 && !this._isServerWillStopExecuting) {
            this._wsServer && this._wsServer.close(e => {
                this._rsStopping = this._rjStopping = undefined;
                this._status = 'closed';
                e ? this._rjStopping!(e) : this._rsStopping!();
            });
        }
    }

    private async _handleApi(conn: ActiveConnection<ServerCustomType>, service: ApiServiceDef, sn: number, reqBody: any) {
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

    private async _handleMsg(conn: ActiveConnection<ServerCustomType>, service: MsgServiceDef, msgBody: any) {
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
            console.debug('[UNHANDLED_MSG]', service.name);
        }
    }

    private _isServerWillStopExecuting?: any;
    private _rsStopping?: () => void;
    private _rjStopping?: (e: any) => void;
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
                this._rsStopping = rs;
                this._rjStopping = rj;
                this._isServerWillStopExecuting = undefined;

                if (this._options.onServerWillStop) {
                    this._isServerWillStopExecuting = this._options.onServerWillStop(this._conns);
                    await this._isServerWillStopExecuting;
                    this._isServerWillStopExecuting = undefined;
                }

                if (this._conns.length) {
                    for (let conn of this._conns) {
                        conn.close();
                    }
                }
                else {
                    this._wsServer && this._wsServer.close(e => {
                        this._rsStopping = this._rjStopping = undefined;
                        this._status = 'closed';
                        e ? rj(e) : rs();
                    });
                }
            }
        });

        output.then(() => {
            console.log('[SRV_STOP] Server stopped');
            this._status = 'closed';
            this._wsServer = undefined;
        })

        return output;
    }

    // API 只能实现一次
    implementApi<T extends keyof ServerCustomType['req']>(apiName: T, handler: ApiHandler<ServerCustomType['req'][T], ServerCustomType['res'][T], ServerCustomType>) {
        if (this._apiHandlers[apiName as string]) {
            throw new Error('Already exist handler for API: ' + apiName);
        }
        this._apiHandlers[apiName as string] = handler;
    };

    // Msg 可以重复监听
    listenMsg<T extends keyof ServerCustomType['msg']>(msgName: T, handler: MsgHandler<ServerCustomType['msg'][T], ServerCustomType>) {
        this._msgHandlers.addHandler(msgName as string, handler);
    };

    unlistenMsg<T extends keyof ServerCustomType['msg']>(msgName: T, handler?: MsgHandler<ServerCustomType['msg'][T], ServerCustomType>) {
        this._msgHandlers.removeHandler(msgName as string, handler);
    };

    // Send Msg
    async sendMsg<T extends keyof ServerCustomType['msg']>(connIds: string[], msgName: T, msg: ServerCustomType['msg'][T]): Promise<void> {
        if (this.status !== 'open') {
            console.error('Server not open, sendMsg failed');
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
                console.error('SendMsg failed, invalid connId: ' + v)
            }
        }))
    };

    private _status: ServerStatus = 'closed';
    public get status(): ServerStatus {
        return this._status;
    }

    private _autoImplementApis(apiPath: string): { succ: string[], fail: string[] } {
        let apiServices = Object.values(this._serviceMap.apiName2Service) as ApiServiceDef[];
        let output: { succ: string[], fail: string[] } = { succ: [], fail: [] };

        for (let svc of apiServices) {
            //get matched Api
            let apiHandler: Function | undefined;

            // get api last name
            let match = svc.name.match(/^(.+\/)*(.+)$/);
            if (!match) {
                console.warn('Invalid apiName: ' + svc.name);
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
                console.warn('Auto implement api fail: ' + svc.name);
                continue;
            }

            this.implementApi(svc.name, apiHandler as any);
            console.log('Auto implement api succ: ' + svc.name);
            output.succ.push(svc.name);
        }

        return output;
    }
}

export type ServerStatus = 'opening' | 'open' | 'closing' | 'closed';

const defaultServerOptions: ServerOptions = {
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

export type ServerOptions<ServerCustomType extends BaseServerCustomType = any> = {
    /** Http短连接端口 无则不监听 */
    httpPort?: number;
    /** WebSocket长连接端口 无则不监听 */
    wsPort?: number;
    proto: string | ServiceProto;
    apiPath?: string;
    defaultSession: ServerCustomType['session'];
    onServerWillStop?: (conns: ActiveConnection[]) => (Promise<void> | void);
};


// Flow：return true 代表继续flow，否则为立即中止
export type ApiFlowItem<
    Req = any,
    Res = any,
    ServerCustomType extends BaseServerCustomType = any
    > = (call: ApiCall<Req, Res, ServerCustomType>) => boolean | Promise<boolean>;
export type MsgFlowItem<
    Msg = any,
    ServerCustomType extends BaseServerCustomType = any
    > = (msg: MsgCall<Msg, ServerCustomType>) => boolean | Promise<boolean>;