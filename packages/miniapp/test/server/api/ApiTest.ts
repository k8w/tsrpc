import { ApiCallHttp } from "tsrpc";
import { TsrpcError } from "tsrpc-proto";
import { ReqTest, ResTest } from "../../proto/PtlTest";

export async function ApiTest(call: ApiCallHttp<ReqTest, ResTest>) {
    if (call.req.name === 'InnerError') {
        throw new Error('Test InnerError')
    }
    else if (call.req.name === 'TsrpcError') {
        throw new TsrpcError('Test TsrpcError', { info: 'ErrInfo Test' });
    }
    else if (call.req.name === 'Delay') {
        await new Promise<void>(rs => {
            setTimeout(() => {
                call.succ({
                    reply: 'Reply Timeout'
                });
                rs();
            }, 500)
        })
    }
    else if (call.req.name === 'Timeout') {
        await new Promise<void>(rs => {
            setTimeout(() => {
                call.succ({
                    reply: 'Reply Timeout'
                });
                rs();
            }, 5000)
        })
    }
    else {
        call.succ({
            reply: 'Test reply: ' + call.req.name
        })
    }
}