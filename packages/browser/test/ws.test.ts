import { assert } from 'chai';
import { KUnit } from 'kunit';
import { TransportDataUtil, WsClientStatus } from '../node_modules/tsrpc-base-client';
import { TsrpcError, TsrpcErrorType, WsClient } from '../src/index';
import { MsgChat } from './proto/MsgChat';
import { ReqExtendData } from './proto/PtlExtendData';
import { serviceProto } from './proto/serviceProto';

export let client = new WsClient(serviceProto, {
    server: 'ws://127.0.0.1:4000',
    logger: console,
    debugBuf: true
});

export const kunit = new KUnit();

kunit.test('Connect', async function () {
    let res = await client.connect();
    if (!res.isSucc) {
        console.log('conn failed', res.errMsg);
    }
    assert.strictEqual(res.isSucc, true);
})

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
        assert.deepStrictEqual(await client.callApi(v as any, {
            name: 'InnerError'
        }), {
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
            err: new TsrpcError({
                message: v + ' TsrpcError',
                type: TsrpcErrorType.ApiError,
                info: 'ErrInfo ' + v
            })
        });
    }
})

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
    let client1 = new WsClient(serviceProto, {
        server: 'ws://localhost:9999'
    })

    let ret = await client1.connect()
    assert.strictEqual(ret.isSucc, false);
})

kunit.test('client timeout', async function () {
    let client2 = new WsClient(serviceProto, {
        server: 'ws://127.0.0.1:4000',
        timeout: 100
    });
    await client2.connect();

    let result = await client2.callApi('Test', { name: 'Timeout' });
    assert.deepStrictEqual(result, {
        isSucc: false,
        err: new TsrpcError({
            message: 'Request Timeout',
            code: 'TIMEOUT',
            type: TsrpcErrorType.NetworkError
        })
    });

    await client2.disconnect();
});

kunit.test('send/listen Msg', async function () {
    let recved: MsgChat[] = [];
    let handler = (v: MsgChat) => {
        recved.push(v);
    };

    client.listenMsg('Chat', handler);

    client.sendMsg('Chat', {
        channel: 111,
        userName: 'Peter',
        content: 'Good morning~',
        time: Date.now()
    });

    await new Promise<void>(rs => {
        setTimeout(() => {
            rs();
        }, 1000);
    })

    client.unlistenMsg('Chat', handler);
    assert.deepStrictEqual(recved, [
        {
            channel: 111,
            userName: 'System',
            content: 'Good morning~',
            time: 111
        },
        {
            channel: 111,
            userName: 'System',
            content: 'Good morning~',
            time: 222
        }
    ])
})

kunit.test('disconnect', async function () {
    await client.disconnect();
})

kunit.test('Client heartbeat works', async function () {
    let client = new WsClient(serviceProto, {
        server: 'ws://127.0.0.1:4000',
        logger: console,
        heartbeat: {
            interval: 1000,
            timeout: 1000
        },
    });
    await client.connect();

    await new Promise(rs => { setTimeout(rs, 2000) });
    client.logger?.log('lastHeartbeatLatency', client.lastHeartbeatLatency);
    assert.strictEqual(client.status, WsClientStatus.Opened)
    assert.ok(client.lastHeartbeatLatency > 0);

    await client.disconnect();
})

kunit.test('Client heartbeat error', async function () {
    let client = new WsClient(serviceProto, {
        server: 'ws://127.0.0.1:4000',
        logger: console,
        heartbeat: {
            interval: 1000,
            timeout: 1000
        },
    });

    let disconnectFlowData: { isManual?: boolean } | undefined;
    client.flows.postDisconnectFlow.push(v => {
        disconnectFlowData = {}
        return v;
    })

    await client.connect();

    const temp = TransportDataUtil.HeartbeatPacket;
    (TransportDataUtil as any).HeartbeatPacket = new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3, 4, 5]);

    await new Promise(rs => { setTimeout(rs, 2000) });
    client.logger?.log('lastHeartbeatLatency', client.lastHeartbeatLatency);

    assert.strictEqual(client.status, WsClientStatus.Closed)
    assert.deepStrictEqual(disconnectFlowData, {})

    await client.disconnect();
    (TransportDataUtil as any).HeartbeatPacket = temp;
})