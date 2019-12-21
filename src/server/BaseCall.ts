import { PrefixLogger } from './Logger';
import { ApiError, ApiServiceDef, MsgServiceDef, TsrpcError } from 'tsrpc-proto';
import { PoolItem } from '../models/Pool';

export interface ApiCallOptions<Req=any, Res=any> {
    conn: any,
    logger: PrefixLogger,
    service: ApiServiceDef,
    sn: number,
    req: Req,
    // 已发送的响应
    res?: { isSucc: true, data: Res, usedTime: number } | ({ isSucc: false, error: TsrpcError, usedTime: number }),
    startTime: number
}
export abstract class ApiCall<Req = any, Res = any, CallOptions extends ApiCallOptions<Req,Res> = ApiCallOptions<Req,Res>> extends PoolItem<CallOptions> {
    readonly type = 'api' as const;

    get logger() {
        return this.options.logger;
    }

    get service() {
        return this.options.service;
    }

    get sn() {
        return this.options.sn;
    }

    get req() {
        return this.options.req;
    }

    get res() {
        return this.options.res;
    }

    get startTime() {
        return this.options.startTime;
    }

    clean() {
        PrefixLogger.pool.put(this.options.logger);
        super.clean();
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