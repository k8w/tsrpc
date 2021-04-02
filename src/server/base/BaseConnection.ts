import { BaseServiceType, Logger } from "tsrpc-proto";
import { TransportDataUtil } from "../../models/TransportDataUtil";
import { PrefixLogger } from "../models/PrefixLogger";
import { ApiCall } from "./ApiCall";
import { BaseServer } from "./BaseServer";

export interface BaseConnectionOptions<ServiceType extends BaseServiceType> {
    /** Server端自增 */
    id: string;
    ip: string,
    server: BaseServer<ServiceType>,
    logger?: Logger
}

export abstract class BaseConnection<ServiceType extends BaseServiceType> {
    /** Long or Short connection */
    abstract readonly type: 'LONG' | 'SHORT';

    readonly id: string;
    readonly ip: string;
    readonly server: BaseServer;
    readonly logger: Logger;

    constructor(options: BaseConnectionOptions<ServiceType>,) {
        this.id = options.id;
        this.ip = options.ip;
        this.server = options.server;
        this.logger = options.logger ?? new PrefixLogger({
            logger: options.server.logger,
            prefixs: [`Conn#${options.id} ${options.ip}`]
        });
    }

    abstract get status(): ConnectionStatus;
    abstract close(reason?: string): void;

    abstract sendBuf(buf: Uint8Array, call?: ApiCall): Promise<{ isSucc: true } | { isSucc: false, errMsg: string }>;

    async sendMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T]): Promise<{ isSucc: true } | { isSucc: false, errMsg: string }> {
        if (this.type === 'SHORT') {
            return {isSucc: false, errMsg: 'Short connection cannot sendMsg'}
        }
        
        let service = this.server.serviceMap.msgName2Service[msgName as string];
        if (!service) {
            return { isSucc: false, errMsg: `Invalid msg name: ${msgName}` }
        }

        // Pre Flow
        let pre = await this.server.flows.preSendMsgFlow.exec({ conn: this, service: service, msg: msg });
        if (!pre) {
            return { isSucc: false, errMsg: 'sendMsg prevent by preSendMsgFlow' };
        }
        msg = pre.msg;

        // Encode
        let opServerOutput = TransportDataUtil.encodeMsg(this.server.tsbuffer, service, msg);
        if (!opServerOutput.isSucc) {
            return opServerOutput;
        }

        // Do send!
        let opSend = await this.sendBuf(opServerOutput.buf);
        if (!opSend.isSucc) {
            return opSend;
        }

        // Post Flow
        await this.server.flows.postSendMsgFlow.exec(pre);

        return { isSucc: true };
    }

    destroy() {
        if (this.status === ConnectionStatus.Opened) {
            this.close('DESTROY');
        }

        for (let key in this) {
            this[key] = undefined as any;
        }
    };
}

export enum ConnectionStatus {
    Opened = 'OPENED',
    Closing = 'CLOSING',
    Closed = 'CLOSED'
}