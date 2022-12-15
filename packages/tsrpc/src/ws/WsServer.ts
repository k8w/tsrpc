import http from "http";
import https from "https";
import { BaseServiceType, ServiceProto } from "tsrpc-base";
import { BaseServer } from "tsrpc-base-server";
import { WebSocketServer } from "ws";
import { defaultHttpServerOptions } from "../http/HttpServer";
import { BaseNodeServerOptions, defaultBaseNodeServerOptions } from "../models/BaseNodeServerOptions";
import { getClassObjectId } from "../models/getClassObjectId";
import { processUncaughtException } from "../models/processUncaughtException";
import { TSRPC_VERSION } from "../models/version";
import { WsServerConnection } from "./WsServerConnection";

export class WsServer<ServiceType extends BaseServiceType = any> extends BaseServer<ServiceType>{

    declare options: WsServerOptions;
    declare $Conn: WsServerConnection<ServiceType>;

    private _wsServer?: WebSocketServer;
    private _httpServer?: http.Server | https.Server;

    constructor(serviceProto: ServiceProto<ServiceType>, options?: Partial<WsServerOptions>) {
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
        this.logger.log(`Starting ${this.options.wss ? 'WSS' : 'WS'} server at port ${this.options.port}... (json=${!!this.options.json})`);

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
            this._wsServer = new WebSocketServer({
                server: this._httpServer
            });
            this._wsServer.on('connection', (ws, httpReq) => {
                const conn = new WsServerConnection(this, {
                    ws: ws,
                    httpReq: httpReq
                });
                this.addConnection(conn);
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

export const defaultWsServerOptions: WsServerOptions = {
    ...defaultBaseNodeServerOptions,
    port: 3000
}

export interface WsServerOptions extends BaseNodeServerOptions {
    /** Which port the WebSocket server is listen to */
    port: number;

    /**
     * HTTPS options, the server would use wss instead of http if this value is defined.
     * NOTICE: Once you enabled wss, you CANNOT visit the server via `ws://` anymore.
     * If you need visit the server via both `ws://` and `wss://`, you can start 2 WsServer (one with `wss` and another without).
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