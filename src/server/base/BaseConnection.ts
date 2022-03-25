import { MsgHandlerManager, ParsedServerInput, TransportDataUtil } from "tsrpc-base-client";
import { BaseServiceType } from "tsrpc-proto";
import { PrefixLogger } from "../models/PrefixLogger";
import { ApiCall } from "./ApiCall";
import { BaseServer, MsgHandler } from "./BaseServer";
import { MsgCall } from "./MsgCall";

export interface BaseConnectionOptions<ServiceType extends BaseServiceType = any> {
    /** Created by server, each Call has a unique id. */
    id: string;
    /** Client IP address */
    ip: string,
    server: BaseServer<ServiceType>,
    dataType: 'text' | 'buffer' | 'json'
}

export abstract class BaseConnection<ServiceType extends BaseServiceType = any> {
    /** It is long connection or short connection */
    abstract readonly type: 'LONG' | 'SHORT';

    protected abstract readonly ApiCallClass: { new(options: any): ApiCall };
    protected abstract readonly MsgCallClass: { new(options: any): MsgCall };

    /** Connection unique ID */
    readonly id: string;
    /** Client IP address */
    readonly ip: string;
    readonly server: BaseServer<ServiceType>;
    readonly logger: PrefixLogger;
    dataType: BaseConnectionOptions['dataType'];

    constructor(options: BaseConnectionOptions<ServiceType>, logger: PrefixLogger) {
        this.id = options.id;
        this.ip = options.ip;
        this.server = options.server;
        this.logger = logger;
        this.dataType = options.dataType;
    }

    abstract get status(): ConnectionStatus;
    /** Close the connection */
    abstract close(reason?: string): void;

    /** Send buffer (with pre-flow and post-flow) */
    async sendData(data: string | Uint8Array | object, call?: ApiCall): Promise<{ isSucc: true } | { isSucc: false, errMsg: string, canceledByFlow?: boolean }> {
        // Pre Flow
        let pre = await this.server.flows.preSendDataFlow.exec({ conn: this, data: data, call: call }, call?.logger || this.logger);
        if (!pre) {
            return { isSucc: false, errMsg: 'Canceled by preSendDataFlow', canceledByFlow: true };
        }
        data = pre.data;

        // @deprecated Pre Buffer Flow
        if (data instanceof Uint8Array) {
            let preBuf = await this.server.flows.preSendBufferFlow.exec({ conn: this, buf: data, call: call }, call?.logger || this.logger);
            if (!preBuf) {
                return { isSucc: false, errMsg: 'Canceled by preSendBufferFlow', canceledByFlow: true };
            }
            data = preBuf.buf;
        }

        // debugBuf log
        if (this.server.options.debugBuf) {
            if (typeof data === 'string') {
                (call?.logger ?? this.logger)?.debug(`[SendText] length=${data.length}`, data);
            }
            else if (data instanceof Uint8Array) {
                (call?.logger ?? this.logger)?.debug(`[SendBuf] length=${data.length}`, data);
            }
            else {
                (call?.logger ?? this.logger)?.debug('[SendJSON]', data);
            }
        }

        return this.doSendData(data, call);
    }
    protected abstract doSendData(data: string | Uint8Array | object, call?: ApiCall): Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>;

    makeCall(input: ParsedServerInput): ApiCall | MsgCall {
        if (input.type === 'api') {
            return new this.ApiCallClass({
                conn: this,
                service: input.service,
                req: input.req,
                sn: input.sn,
            })
        }
        else {
            return new this.MsgCallClass({
                conn: this,
                service: input.service,
                msg: input.msg
            })
        }
    }

    /**
     * Send message to the client, only be available when it is long connection.
     * @param msgName 
     * @param msg - Message body
     * @returns Promise resolved when the buffer is sent to kernel, it not represents the server received it.
     */
    async sendMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T]): ReturnType<BaseConnection['sendData']> {
        if (this.type === 'SHORT') {
            this.logger.warn('[SendMsgErr]', `[${msgName}]`, 'Short connection cannot sendMsg');
            return { isSucc: false, errMsg: 'Short connection cannot sendMsg' }
        }

        let service = this.server.serviceMap.msgName2Service[msgName as string];
        if (!service) {
            this.logger.warn('[SendMsgErr]', `[${msgName}]`, `Invalid msg name: ${msgName}`);
            return { isSucc: false, errMsg: `Invalid msg name: ${msgName}` }
        }

        // Pre Flow
        let pre = await this.server.flows.preSendMsgFlow.exec({ conn: this, service: service, msg: msg }, this.logger);
        if (!pre) {
            return { isSucc: false, errMsg: 'Canceled by preSendMsgFlow', canceledByFlow: true };
        }
        msg = pre.msg;

        // Encode
        let opServerOutput = TransportDataUtil.encodeServerMsg(this.server.tsbuffer, service, msg, this.dataType, this.type);
        if (!opServerOutput.isSucc) {
            this.logger.warn('[SendMsgErr]', `[${msgName}]`, opServerOutput.errMsg);
            return opServerOutput;
        }

        // Do send!
        this.server.options.logMsg && this.logger.log('[SendMsg]', `[${msgName}]`, msg);
        let opSend = await this.sendData(opServerOutput.output);
        if (!opSend.isSucc) {
            return opSend;
        }

        // Post Flow
        await this.server.flows.postSendMsgFlow.exec(pre, this.logger);

        return { isSucc: true };
    }

    // 多个Handler将异步并行执行
    private _msgHandlers?: MsgHandlerManager;
    /**
     * Add a message handler,
     * duplicate handlers to the same `msgName` would be ignored.
     * @param msgName
     * @param handler
     */
    listenMsg<Msg extends keyof ServiceType['msg'], Call extends MsgCall<ServiceType['msg'][Msg]>>(msgName: Msg, handler: MsgHandler<Call>): MsgHandler<Call> {
        if (!this._msgHandlers) {
            this._msgHandlers = new MsgHandlerManager();
        }
        this._msgHandlers.addHandler(msgName as string, handler);
        return handler;
    };
    /**
     * Remove a message handler
     */
    unlistenMsg<Msg extends keyof ServiceType['msg'], Call extends MsgCall<ServiceType['msg'][Msg]>>(msgName: Msg, handler: Function): void {
        if (!this._msgHandlers) {
            this._msgHandlers = new MsgHandlerManager();
        }
        this._msgHandlers.removeHandler(msgName as string, handler);
    };
    /**
     * Remove all handlers from a message
     */
    unlistenMsgAll<Msg extends keyof ServiceType['msg'], Call extends MsgCall<ServiceType['msg'][Msg]>>(msgName: Msg): void {
        if (!this._msgHandlers) {
            this._msgHandlers = new MsgHandlerManager();
        }
        this._msgHandlers.removeAllHandlers(msgName as string);
    };
}

export enum ConnectionStatus {
    Opened = 'OPENED',
    Closing = 'CLOSING',
    Closed = 'CLOSED'
}