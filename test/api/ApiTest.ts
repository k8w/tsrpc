import { ReqTest, ResTest } from "../proto/PtlTest";
import { TsrpcError } from "tsrpc-proto";
import { ApiCall } from '../../src/server/base/BaseCall';

export async function ApiTest(call: ApiCall<ReqTest, ResTest>) {
    if (call.req.name === 'InnerError') {
        throw new Error('Test InnerError')
    }
    else if (call.req.name === 'TsrpcError') {
        throw new TsrpcError('Test TsrpcError', 'ErrInfo Test');
    }
    else {
        call.succ({
            reply: 'Test reply: ' + call.req.name
        })
    }
}