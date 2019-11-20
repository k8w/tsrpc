import { PrefixLogger } from './Logger';
import { ApiError, ApiServiceDef, MsgServiceDef } from 'tsrpc-proto';
import { PoolItem } from '../models/Pool';

export interface ApiCallOptions {
    conn: any,
    logger: PrefixLogger,
    service: ApiServiceDef,
    sn: number,
    req: any,
    startTime: number
}
export abstract class ApiCall<Req = any, Res = any, CallOptions extends ApiCallOptions = ApiCallOptions> extends PoolItem<CallOptions> {
    readonly type = 'api' as const;

    logger!: PrefixLogger;
    service!: ApiServiceDef;
    sn!: number;
    req!: Req;
    // 已发送的响应
    res?: { isSucc: true, data: Res, usedTime: number } | ({ isSucc: false, error: ApiError, usedTime: number });
    // Call开始的时间
    startTime: number = 0;

    reset(options: ApiCallOptions) {
        this.logger = options.logger;
        this.service = options.service;
        this.sn = options.sn;
        this.req = options.req;
        this.res = undefined;
        this.startTime = options.startTime;
    }

    clean() {
        PrefixLogger.pool.put(this.logger);
        this.logger = this.service = this.sn = this.req = this.res = undefined as any;
    }

    abstract succ(data: Res): void;
    abstract error(message: string, info?: any): void;

    // Put into pool
    abstract destroy(): void;
}

export interface MsgCallOptions {
    conn: any,
    logger: PrefixLogger;
    service: MsgServiceDef,
    msg: any
}
export abstract class MsgCall<Msg = any, CallOptions extends MsgCallOptions = MsgCallOptions> extends PoolItem<CallOptions> {
    readonly type = 'msg' as const;

    logger!: PrefixLogger;
    service!: MsgServiceDef;
    msg!: Msg;

    reset(options: MsgCallOptions) {
        this.logger = options.logger;
        this.service = options.service;
        this.msg = options.msg;
    }

    clean() {
        PrefixLogger.pool.put(this.logger);
        this.logger = this.service = this.msg = undefined as any;
    }

    // Put into pool
    abstract destroy(): void;
}

export type BaseCall = ApiCall | MsgCall;