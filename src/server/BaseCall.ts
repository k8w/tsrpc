import { ApiServiceDef, MsgServiceDef } from '../proto/ServiceProto';
import { Logger, PrefixLogger } from './Logger';
import { ApiError } from '../proto/TransportData';

// export class ApiCall {
//     static pool = new Pool(ApiCall);
// }

export interface ApiCall<Req = any, Res = any> {
    type: 'api';
    logger: PrefixLogger;
    service: ApiServiceDef,
    req: Req,
    // 已发送的响应
    res?: { isSucc: true, data: Res } | ({ isSucc: false } & ApiError),

    // Methods
    succ: (data: Res) => void;
    error: (message: string, info?: any) => void;
}

export interface MsgCall<Msg = any> {
    type: 'msg';
    logger: PrefixLogger;
    service: MsgServiceDef,
    msg: Msg
}

export type BaseCall = ApiCall | MsgCall;