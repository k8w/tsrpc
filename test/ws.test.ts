import { assert } from 'chai';
import { WsServer } from '../src/server/ws/WsServer';
import { WsClient } from '../src/client/ws/WsClient';
import { serviceProto, ServiceType } from './proto/serviceProto';
import { ApiTest } from './api/ApiTest';
import { ApiTest as ApiAbcTest } from './api/a/b/c/ApiTest';
import { PrefixLogger } from '../src/server/Logger';
import * as path from "path";
import { MsgChat } from './proto/MsgChat';
import { TsrpcError } from 'tsrpc-proto';

const serverLogger = PrefixLogger.pool.get({
    prefix: '[Server Log]',
    logger: console
});
const clientLogger = PrefixLogger.pool.get({
    prefix: '[Client Log]',
    logger: console
})

async function testApi(server: WsServer<ServiceType>, client: WsClient<ServiceType>) {
    // Succ
    assert.deepStrictEqual(await client.callApi('Test', {
        name: 'Req1'
    }), {
            reply: 'Test reply: Req1'
        });
    assert.deepStrictEqual(await client.callApi('a/b/c/Test', {
        name: 'Req2'
    }), {
            reply: 'a/b/c/Test reply: Req2'
        });

    // Inner error
    for (let v of ['Test', 'a/b/c/Test']) {
        assert.deepStrictEqual(await client.callApi(v as any, {
            name: 'InnerError'
        }).catch(e => ({
            isSucc: false,
            message: e.message,
            info: e.info
        })), {
                isSucc: false,
                message: 'Internal server error',
                info: 'INTERNAL_ERR'
            });
    }

    // TsrpcError
    for (let v of ['Test', 'a/b/c/Test']) {
        assert.deepStrictEqual(await client.callApi(v as any, {
            name: 'TsrpcError'
        }).catch(e => ({
            isSucc: false,
            message: e.message,
            info: e.info
        })), {
                isSucc: false,
                message: v + ' TsrpcError',
                info: 'ErrInfo ' + v
            });
    }
}

describe('HTTP', function () {
    it('implement API manually', async function () {
        let server = new WsServer({
            proto: serviceProto,
            logger: serverLogger
        });
        await server.start();

        server.implementApi('Test', ApiTest);
        server.implementApi('a/b/c/Test', ApiAbcTest);

        let client = new WsClient({
            proto: serviceProto,
            logger: clientLogger
        });
        await client.connect();

        await testApi(server, client);

        await server.stop();
    })

    it('autoImplementApi', async function () {
        let server = new WsServer({
            proto: serviceProto,
            logger: serverLogger
        });
        await server.start();

        server.autoImplementApi(path.resolve(__dirname, 'api'))

        let client = new WsClient({
            proto: serviceProto,
            logger: clientLogger
        });
        await client.connect();

        await testApi(server, client);

        await server.stop();
    });

    it('sendMsg', async function () {
        let server = new WsServer({
            port: 3001,
            proto: serviceProto,
            logger: serverLogger
        });
        await server.start();

        let client = new WsClient({
            server: 'http://127.0.0.1:3001',
            proto: serviceProto,
            logger: clientLogger
        });
        await client.connect();

        return new Promise(rs => {
            let msg: MsgChat = {
                channel: 123,
                userName: 'fff',
                content: '666',
                time: Date.now()
            };

            server.listenMsg('Chat', async v => {
                assert.deepStrictEqual(v.msg, msg);
                await server.stop();
                rs();
            });

            client.sendMsg('Chat', msg);
        })
    })

    it('cancel', async function () {
        let server = new WsServer({
            proto: serviceProto,
            logger: serverLogger
        });
        await server.start();

        server.autoImplementApi(path.resolve(__dirname, 'api'))

        let client = new WsClient({
            proto: serviceProto,
            logger: clientLogger
        });
        await client.connect();

        let result: any | undefined;
        let promise = client.callApi('Test', { name: 'aaaaaaaa' });
        setTimeout(() => {
            promise.cancel();
        }, 0);
        promise.then(v => {
            result = v;
        });

        await new Promise(rs => {
            setTimeout(() => {
                assert.strictEqual(result, undefined);
                rs();
            }, 100)
        })

        await server.stop();
    });

    it('error', async function () {
        let server = new WsServer({
            proto: serviceProto,
            logger: serverLogger
        });
        await server.start();

        let client1 = new WsClient({
            server: 'http://localhost:80',
            proto: serviceProto,
            logger: clientLogger
        })

        let err1: TsrpcError | undefined;
        await client1.connect().catch(e => {
            err1 = e
        })
        assert.strictEqual(err1!.info.isNetworkError, true);
        assert(err1!.message.indexOf('ECONNREFUSED') > -1)

        await server.stop();
    })
})