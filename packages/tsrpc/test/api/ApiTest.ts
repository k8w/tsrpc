import { ApiCall, TsrpcError } from "tsrpc-base";
import { ReqTest, ResTest } from "../proto/PtlTest";

export async function ApiTest(call: ApiCall<ReqTest, ResTest>) {
    if (call.req.name === 'InnerError') {
        await new Promise(rs => { setTimeout(rs, 50) })
        throw new Error('Test InnerError')
    }
    else if (call.req.name === 'TsrpcError') {
        await new Promise(rs => { setTimeout(rs, 50) })
        throw new TsrpcError('Test TsrpcError', {
            code: 'CODE_TEST',
            info: 'ErrInfo Test'
        });
    }
    else if (call.req.name === 'error') {
        await new Promise(rs => { setTimeout(rs, 50) })
        call.error('Got an error')
    }
    else {
        await new Promise(rs => { setTimeout(rs, 50) })
        call.succ({
            reply: 'Test reply: ' + call.req.name
        })
    }
}