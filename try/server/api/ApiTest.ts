import { TsrpcError } from "../../../src/models/TsrpcError";
import { ApiCallHttp } from '../../../src/server/http/HttpCall';
import { ReqTest } from "../../proto/PtlTest";
import { ResTest } from '../../proto/a/b/c/PtlTest';

export async function ApiTest(call: ApiCallHttp<ReqTest, ResTest>) {
    if (Math.random() > 0.75) {
        call.succ({
            reply: 'Hello, ' + call.req.name
        })
    }
    else if (Math.random() > 0.5) {
        call.error('What the fuck??', { msg: '哈哈哈哈' })
    }
    else if (Math.random() > 0.25) {
        throw new Error('这应该是InternalERROR')
    }
    else {
        throw new TsrpcError('返回到前台的错误', 'ErrInfo');
    }
}