import { Logger } from "../models/Logger";
import { ApiService } from "../models/ServiceMapUtil";
import { ApiReturn } from "../proto/ApiReturn";
import { TransportData } from "../proto/TransportData";
import { BaseTransport } from "./BaseTransport";

// 每一次 Api 调用都会生成一个 ApiCall（Server & Client）
// call.succ & call.error 可用于返回
// Server 的 call.succ / call.error ：sendReturn
// Client 的 call.succ / call.error ：拦截请求，本地 mock
// Call 分角色（Req or Ret）（Server or Client）

export class ApiCall<Req = any, Res = any, Conn extends BaseTransport = BaseTransport> {

    public req!: Req;
    public sn!: number;
    ret?: ApiReturn<Res>;
    logger?: Logger;

    constructor(
        public conn: Conn,
        public transportData: TransportData & { type: 'req' },
        public readonly service: ApiService
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
        // TODO protoInfo
    }

    error(message: string, params?: any) {
        // this.conn['_sendTransportData']({type: 'ret'});
        // log [ApiErr]
        // this.conn['_sendTransportData']({
        //     type: 'ret',
        //     sn: transportData.sn,
        //     // TODO
        //     ret: { isSucc: false, err: new TsrpcError('xxx') },
        //     protoInfo: transportData.protoInfo && this._localProtoInfo
        // });
    }

    protected _sendRet(){}

}