import { assert } from 'chai';
import { HttpServer } from '../src/server/http/HttpServer';
import { HttpClient } from '../src/client/http/HttpClient';
import { serviceProto, ServiceType } from './proto/serviceProto';
import { ApiTest } from './api/ApiTest';
import { ApiTest as ApiAbcTest } from './api/a/b/c/ApiTest';
import { PrefixLogger } from '../src/server/Logger';
import * as path from "path";
import { MsgChat } from './proto/MsgChat';
import { TsrpcError } from 'tsrpc-proto';

const serverLogger = PrefixLogger.pool.get({
    prefixs: ['[Server Log]'],
    logger: console
});
const clientLogger = PrefixLogger.pool.get({
    prefixs: ['[Client Log]'],
    logger: console
})

async function testApi(server: HttpServer<ServiceType>, client: HttpClient<ServiceType>) {
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

describe('HttpClient', function () {
    it('implement API manually', async function () {
        let server = new HttpServer({
            proto: serviceProto,
            logger: serverLogger
        });
        await server.start();

        server.implementApi('Test', ApiTest);
        server.implementApi('a/b/c/Test', ApiAbcTest);

        let client = new HttpClient({
            proto: serviceProto,
            logger: clientLogger
        })

        await testApi(server, client);

        await server.stop();
    })

    it('autoImplementApi', async function () {
        let server = new HttpServer({
            proto: serviceProto,
            logger: serverLogger
        });
        await server.start();

        server.autoImplementApi(path.resolve(__dirname, 'api'))

        let client = new HttpClient({
            proto: serviceProto,
            logger: clientLogger
        })

        await testApi(server, client);

        await server.stop();
    });

    it('sendMsg', async function () {
        let server = new HttpServer({
            port: 3001,
            proto: serviceProto,
            logger: serverLogger
        });
        await server.start();

        let client = new HttpClient({
            server: 'http://127.0.0.1:3001',
            proto: serviceProto,
            logger: clientLogger
        });

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
        let server = new HttpServer({
            proto: serviceProto,
            logger: serverLogger
        });
        await server.start();

        server.autoImplementApi(path.resolve(__dirname, 'api'))

        let client = new HttpClient({
            proto: serviceProto,
            logger: clientLogger
        })

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
        let server = new HttpServer({
            proto: serviceProto,
            logger: serverLogger
        });
        await server.start();

        let client1 = new HttpClient({
            server: 'http://localhost:80',
            proto: serviceProto,
            logger: clientLogger
        })

        let err1: TsrpcError | undefined;
        await client1.callApi('Test', { name: 'xx' }).catch(e => {
            err1 = e
        })
        assert.deepStrictEqual(err1!.info, 'ECONNREFUSED');

        await server.stop();
    })

    it('server timeout', async function () {
        let server = new HttpServer({
            proto: serviceProto,
            logger: serverLogger,
            timeout: 100
        });
        server.implementApi('Test', call => {
            return new Promise(rs => {
                setTimeout(() => {
                    call.req && call.succ({
                        reply: 'Hi, ' + call.req.name
                    });
                    rs();
                }, 200)
            })
        })
        await server.start();

        let client = new HttpClient({
            proto: serviceProto,
            logger: clientLogger
        });
        let result = await client.callApi('Test', { name: 'Jack' }).catch(e => e);
        assert.deepStrictEqual(result, { message: 'Server Timeout', info: 'TIMEOUT' });

        await server.stop();
    });

    it('client timeout', async function () {
        let server = new HttpServer({
            proto: serviceProto,
            logger: serverLogger
        });
        server.implementApi('Test', call => {
            return new Promise(rs => {
                setTimeout(() => {
                    call.succ({
                        reply: 'Hi, ' + call.req.name
                    });
                    rs();
                }, 2000)
            })
        })
        await server.start();

        let client = new HttpClient({
            timeout: 100,
            proto: serviceProto,
            logger: clientLogger
        });
        let result = await client.callApi('Test', { name: 'Jack' }).catch(e => e);
        assert.strictEqual(result.message, 'Request Timeout');
        assert.strictEqual(result.info, 'TIMEOUT');

        await server.stop();
    });
})