import { assert } from 'chai';
import { HttpServer } from '../src/server/http/HttpServer';
import { HttpClient } from '../src/client/http/HttpClient';
import { serviceProto, ServiceType } from './proto/serviceProto';
import { ApiTest } from './api/ApiTest';
import { ApiTest as ApiAbcTest } from './api/a/b/c/ApiTest';
import { PrefixLogger, Logger } from '../src/server/models/PrefixLogger';
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
            info: {
                code: 'INTERNAL_ERR',
                isServerError: true
            }
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

function encrypter(src: Uint8Array) {
    let buf = src.slice();
    for (let i = 0; i < buf.length; ++i) {
        buf[i]++
    }
    return buf;
}
function decrypter(src: Uint8Array) {
    let buf = src.slice();
    for (let i = 0; i < buf.length; ++i) {
        buf[i]--
    }
    return buf;
}

describe('HttpClient', function () {
    it('implement API manually', async function () {
        let server = new HttpServer({
            proto: serviceProto,
            logger: serverLogger,
            encrypter: encrypter,
            decrypter: decrypter
        });
        await server.start();

        server.implementApi('Test', ApiTest);
        server.implementApi('a/b/c/Test', ApiAbcTest);

        let client = new HttpClient({
            proto: serviceProto,
            logger: clientLogger,
            encrypter: encrypter,
            decrypter: decrypter
        })

        await testApi(server, client);

        await server.stop();
    })

    it('sendMsg', async function () {
        let server = new HttpServer({
            port: 3001,
            proto: serviceProto,
            logger: serverLogger,
            encrypter: encrypter,
            decrypter: decrypter,
            debugBuf: true
        });
        await server.start();

        let client = new HttpClient({
            server: 'http://127.0.0.1:3001',
            proto: serviceProto,
            logger: clientLogger,
            encrypter: encrypter,
            decrypter: decrypter,
            debugBuf: true
        });

        await new Promise<void>(rs => {
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

    it('error', async function () {
        let server = new HttpServer({
            proto: serviceProto,
            logger: serverLogger,
            encrypter: encrypter,
            decrypter: decrypter
        });
        await server.start();

        let client1 = new HttpClient({
            server: 'http://localhost:80',
            proto: serviceProto,
            logger: clientLogger,
            encrypter: encrypter,
            decrypter: decrypter
        })

        let err1: TsrpcError | undefined;
        await client1.callApi('Test', { name: 'xx' }).catch(e => {
            err1 = e
        })
        assert.deepStrictEqual(err1!.info, { code: 'ECONNREFUSED', isNetworkError: true });

        await server.stop();
    })

})