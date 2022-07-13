import { assert } from 'chai';
import { KUnit } from 'kunit';
import { TsrpcError, TsrpcErrorType } from '../src';
import { HttpClient } from '../src/client/HttpClient';
import { MsgChat } from './proto/MsgChat';
import { ReqExtendData } from './proto/PtlExtendData';
import { serviceProto } from './proto/serviceProto';

export let client = new HttpClient(serviceProto, {
    server: 'http://localhost:3000',
    logger: console,
    debugBuf: true
});

export const kunit = new KUnit();

kunit.test('CallApi normally', async function () {
    // Succ
    assert.deepStrictEqual(await client.callApi('Test', {
        name: 'Req1'
    }), {
        isSucc: true,
        res: {
            reply: 'Test reply: Req1'
        }
    });
    assert.deepStrictEqual(await client.callApi('a/b/c/Test', {
        name: 'Req2'
    }), {
        isSucc: true,
        res: {
            reply: 'a/b/c/Test reply: Req2'
        }
    });
});

kunit.test('Inner Error', async function () {
    for (let v of ['Test', 'a/b/c/Test']) {
        let ret = await client.callApi(v as any, {
            name: 'InnerError'
        });
        console.log('aaa', (ret.err as any).__proto__ === TsrpcError.prototype)
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('Internal Server Error', {
                code: 'INTERNAL_ERR',
                type: TsrpcErrorType.ServerError,
                innerErr: v + ' InnerError',
            })
        });
    }
})

kunit.test('TsrpcError', async function () {
    for (let v of ['Test', 'a/b/c/Test']) {
        assert.deepStrictEqual(await client.callApi(v as any, {
            name: 'TsrpcError'
        }), {
            isSucc: false,
            err: new TsrpcError(v + ' TsrpcError', {
                info: 'ErrInfo ' + v
            })
        });
    }
})

kunit.test('sendMsg', async function () {
    let msg: MsgChat = {
        channel: 123,
        userName: 'fff',
        content: '666',
        time: Date.now()
    };

    await client.sendMsg('Chat', msg);
})

kunit.test('abort', async function () {
    let result: any | undefined;
    let promise = client.callApi('Test', { name: 'aaaaaaaa' });
    setTimeout(() => {
        client.abort(client.lastSN);
    }, 0);
    promise.then(v => {
        result = v;
    });

    await new Promise<void>(rs => {
        setTimeout(() => {
            assert.strictEqual(result, undefined);
            rs();
        }, 100)
    })
})

kunit.test('error', async function () {
    let client1 = new HttpClient(serviceProto, {
        server: 'http://localhost:9999'
    })

    let res = await client1.callApi('Test', { name: 'xx' })
    assert.strictEqual(res.isSucc, false);
    assert.strictEqual(res.err?.type, TsrpcErrorType.NetworkError);
})

kunit.test('client timeout', async function () {
    let client = new HttpClient(serviceProto, {
        timeout: 100
    });
    let result = await client.callApi('Test', { name: 'Timeout' });
    assert.deepStrictEqual(result, {
        isSucc: false,
        err: new TsrpcError({
            message: 'Request Timeout',
            code: 'TIMEOUT',
            type: TsrpcErrorType.NetworkError
        })
    });
});

kunit.test('ExtendData', async function () {
    let data: ReqExtendData['data'] = {
        objectId: '616d62d2af8690290c9bd2ce' as any,
        date: new Date('2021/11/7'),
        buf: new Uint8Array([1, 2, 3, 4, 5, 255, 254, 253, 252, 251, 250])
    }
    let ret = await client.callApi('ExtendData', {
        data: data
    });
    assert.deepStrictEqual(ret, {
        isSucc: true,
        res: {
            data: data
        }
    });
})