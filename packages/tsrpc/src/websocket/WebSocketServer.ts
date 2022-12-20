import http from "http";
import https from "https";
import { BaseServiceType, ServiceProto } from "tsrpc-base";
import { BaseServer } from "tsrpc-base-server";
import { WebSocketServer as ws_WebSocketServer } from "ws";
import { defaultHttpServerOptions } from "../http/HttpServer";
import { BaseNodeServerOptions, defaultBaseNodeServerOptions } from "../models/BaseNodeServerOptions";
import { getClassObjectId } from "../models/getClassObjectId";
import { processUncaughtException } from "../models/processUncaughtException";
import { TSRPC_VERSION } from "../models/version";
import { WebSocketServerConnection } from "./WebSocketServerConnection";

export class WebSocketServer<ServiceType extends BaseServiceType = any> extends BaseServer<ServiceType>{

    declare options: WebSocketServerOptions;
    declare $Conn: WebSocketServerConnection<ServiceType>;

    private _wsServer?: ws_WebSocketServer;
    private _httpServer?: http.Server | https.Server;

    constructor(serviceProto: ServiceProto<ServiceType>, options?: Partial<WebSocketServerOptions>) {
        super(serviceProto, {
            ...defaultHttpServerOptions,
            ...options
        }, {
            classObjectId: getClassObjectId(),
            env: {
                tsrpc: TSRPC_VERSION,
                node: process.version
            }
        });
        processUncaughtException(this.logger);
    }

    protected _start(): Promise<string> {
        this.logger.info(`Starting WebSocket${this.options.wss ? '(WSS)' : ''} server at port ${this.options.port}... (json=${!!this.options.json})`);

        return new Promise<string>((rs, rj) => {
            // Create HTTP/S Server
            // Create Server
            if (this.options.wss) {
                this._httpServer = https.createServer({ ...this.options.wss })
            }
            else {
                this._httpServer = http.createServer({})
            }

            // Create WebSocket Server
            this._wsServer = new ws_WebSocketServer({
                server: this._httpServer
            });
            this._wsServer.on('connection', (ws, httpReq) => {
                const conn = new WebSocketServerConnection(this, {
                    ws: ws,
                    httpReq: httpReq
                });
            });

            // Start Server
            this._httpServer.listen(this.options.port, () => {
                rs(`Server started successfully at port ${this.options.port}`);
            })
        })
    }

    protected _stop(): void {
        this._httpServer?.close();
        this._wsServer = undefined;
        this._httpServer = undefined;
    }

}

export const defaultWebSocketServerOptions: WebSocketServerOptions = {
    ...defaultBaseNodeServerOptions,
    port: 3000
}

export interface WebSocketServerOptions extends BaseNodeServerOptions {
    /** Which port the WebSocket server is listen to */
    port: number;

    /**
     * HTTPS options, the server would use wss instead of http if this value is defined.
     * NOTICE: Once you enabled wss, you CANNOT visit the server via `ws://` anymore.
     * If you need visit the server via both `ws://` and `wss://`, you can start 2 WebSocketServer (one with `wss` and another without).
     * @defaultValue `undefined`
     */
    wss?: {
        /**
         * @example
         * fs.readFileSync('xxx-key.pem');
         */
        key: https.ServerOptions['key'],

        /**
         * @example
         * fs.readFileSync('xxx-cert.pem');
         */
        cert: https.ServerOptions['cert']
    },
}