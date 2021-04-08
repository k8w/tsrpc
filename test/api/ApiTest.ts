import { TsrpcError } from "tsrpc-proto";
import { ApiCall } from "../../src/server/base/ApiCall";
import { ReqTest, ResTest } from "../proto/PtlTest";

export async function ApiTest(call: ApiCall<ReqTest, ResTest>) {
    if (call.req.name === 'InnerError') {
        throw new Error('Test InnerError')
    }
    else if (call.req.name === 'TsrpcError') {
        throw new TsrpcError('Test TsrpcError', {
            code: 'CODE_TEST',
            info: 'ErrInfo Test'
        });
    }
    else if (call.req.name === 'error') {
        call.error('Got an error')
    }
    else {
        call.logger.log('succ');
        call.succ({
            reply: 'Test reply: ' + call.req.name
        })
    }
}