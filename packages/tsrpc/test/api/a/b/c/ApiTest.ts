import { TsrpcError } from "tsrpc-proto";

export async function ApiTest(call: any) {
    if (call.req.name === 'InnerError') {
        throw new Error('a/b/c/Test InnerError')
    }
    else if (call.req.name === 'TsrpcError') {
        throw new TsrpcError('a/b/c/Test TsrpcError', {
            code: 'CODE_TEST',
            info: 'ErrInfo a/b/c/Test'
        });
    }
    else if (call.req.name === 'error') {
        call.error('Got an error')
    }
    else {
        call.succ({
            reply: 'a/b/c/Test reply: ' + call.req.name
        })
    }
}