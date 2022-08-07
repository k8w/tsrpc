import { Logger } from "../models/Logger";
import { ApiService } from "../models/ServiceMapUtil";
import { ApiReturn } from "../proto/ApiReturn";
import { BaseConnection } from "./BaseConnection";

// 每一次 Api 调用都会生成一个 ApiCall（Server & Client）
// call.succ & call.error 可用于返回
// Server 的 call.succ / call.error ：sendReturn
// Client 的 call.succ / call.error ：拦截请求，本地 mock
// Call 分角色（Req or Ret）（Server or Client）

export class ApiCall<Req = any, Res = any, Conn extends BaseConnection = BaseConnection> {

    ret?: ApiReturn<Res>;
    logger?: Logger;

    constructor(
        public conn: Conn,
        public service: ApiService,
        public req: Req,
        public sn: number,
        public readonly role: 'server' | 'client'
    ) {
        // TODO
        // log [ApiReq]
    }

    /** @deprecated Use `ret` instead */
    get return() {
        return this.ret;
    }
    /** @deprecated Use `ret` instead */
    set return(v: ApiCall['ret']) {
        this.ret = v;
    }

    succ() {
        // this.conn['_sendTransportData']({type: 'ret'});
        // log [ApiRes]
    }

    error() {
        // this.conn['_sendTransportData']({type: 'ret'});
        // log [ApiErr]
    }

}

// 双向调用时如何区分 log

// 不好
// [RecvReq] #1 ...
// [SendReq] #1 ...
// [RecvRet] #1 ...
// [SendRet] #1 ...

// 好
// Server [ApiReq] #1 ...
// Client [ApiReq] #1 ...
// Client [ApiRes] #1 ...
// Server [ApiRes] #1 ...

// xxx.preSendReqFlow.push(call => {
//     if (call.req.xxx && call.service.xxx) {
//         call.error('aaaaa');
//         return undefined;
//     }

//     return call;
// })