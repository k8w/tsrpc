import { TsrpcError } from "../../../src/models/TsrpcError";

export async function ApiTest(call: any) {
    if (Math.random() > 0.75) {
        call.succ({
            reply: 'Hello, ' + call.data.name
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