import { TsrpcError } from "tsrpc-proto";
import { ApiCall } from "../../src/server/base/ApiCall";
import { ReqTest, ResTest } from "../proto/PtlTest";

export async function ApiTest(call: ApiCall<ReqTest, ResTest>) {
    if (call.req.name === 'InnerError') {
        await new Promise(rs => { setTimeout(rs, Math.random() * 100) })
        throw new Error('Test InnerError')
    }
    else if (call.req.name === 'TsrpcError') {
        await new Promise(rs => { setTimeout(rs, Math.random() * 100) })
        throw new TsrpcError('Test TsrpcError', {
            code: 'CODE_TEST',
            info: 'ErrInfo Test'
        });
    }
    else if (call.req.name === 'error') {
        await new Promise(rs => { setTimeout(rs, Math.random() * 100) })
        call.error('Got an error')
    }
    else {
        call.logger.log('succ');
        await new Promise(rs => { setTimeout(rs, Math.random() * 100) })
        call.succ({
            reply: 'Test reply: ' + call.req.name
        })
    }
}