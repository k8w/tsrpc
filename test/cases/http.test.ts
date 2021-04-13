import { assert } from 'chai';
import * as path from "path";
import { ServiceProto, TsrpcError, TsrpcErrorType } from 'tsrpc-proto';
import { BaseServer, TerminalColorLogger } from '../../src';
import { HttpClient } from '../../src/client/http/HttpClient';
import { BaseClient } from '../../src/client/models/BaseClient';
import { HttpServer } from '../../src/server/http/HttpServer';
import { PrefixLogger } from '../../src/server/models/PrefixLogger';
import { ApiTest as ApiAbcTest } from '../api/a/b/c/ApiTest';
import { ApiTest } from '../api/ApiTest';
import { MsgChat } from '../proto/MsgChat';
import { serviceProto, ServiceType } from '../proto/serviceProto';

const serverLogger = new PrefixLogger({
    prefixs: [' Server '.bgGreen.white],
    logger: new TerminalColorLogger({ pid: 'Server' })
});
const clientLogger = new PrefixLogger({
    prefixs: [' Client '.bgBlue.white],
    logger: new TerminalColorLogger({ pid: 'Client' })
})

const getProto = () => Object.merge({}, serviceProto) as ServiceProto<ServiceType>;

async function testApi(server: HttpServer<ServiceType>, client: HttpClient<ServiceType>) {
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

    // Inner error
    for (let v of ['Test', 'a/b/c/Test']) {
        let ret = await client.callApi(v as any, {
            name: 'InnerError'
        });
        delete ret.err!.innerErr.stack;

        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('Internal Server Error', {
                code: 'INTERNAL_ERR',
                type: TsrpcErrorType.ServerError,
                innerErr: `${v} InnerError`
            })
        });
    }

    // TsrpcError
    for (let v of ['Test', 'a/b/c/Test']) {
        let ret = await client.callApi(v as any, {
            name: 'TsrpcError'
        });
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError(`${v} TsrpcError`, {
                code: 'CODE_TEST',
                type: TsrpcErrorType.ApiError,
                info: 'ErrInfo ' + v
            })
        });
    }

    // call.error
    for (let v of ['Test', 'a/b/c/Test']) {
        let ret = await client.callApi(v as any, {
            name: 'error'
        });
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('Got an error', {
                type: TsrpcErrorType.ApiError
            })
        });
    }
}

describe('HTTP Server & Client basic', function () {
    it('implement API manually', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger,
            debugBuf: true
        });
        await server.start();

        server.implementApi('Test', ApiTest);
        server.implementApi('a/b/c/Test', ApiAbcTest);

        let client = new HttpClient(getProto(), {
            logger: clientLogger,
            debugBuf: true
        })

        await testApi(server, client);

        await server.stop();
    })

    it('autoImplementApi', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger,
            apiTimeout: 5000
        });
        await server.start();

        server.autoImplementApi(path.resolve(__dirname, '../api'))

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        })

        await testApi(server, client);

        await server.stop();
    });

    it('sendMsg', async function () {
        let server = new HttpServer(getProto(), {
            port: 3001,
            logger: serverLogger,
            // debugBuf: true
        });

        await server.start();

        let client = new HttpClient(getProto(), {
            server: 'http://127.0.0.1:3001',
            logger: clientLogger,
            // debugBuf: true
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

    it('abort', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger
        });
        await server.start();

        server.autoImplementApi(path.resolve(__dirname, '../api'))

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        })

        let result: any | undefined;
        let promise = client.callApi('Test', { name: 'aaaaaaaa' });
        let sn = client.lastSN;
        setTimeout(() => {
            client.abort(sn)
        }, 10);
        promise.then(v => {
            result = v;
        });

        await new Promise<void>(rs => {
            setTimeout(() => {
                assert.strictEqual(result, undefined);
                rs();
            }, 150)
        })

        await server.stop();
    });

    it('pendingApis', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger
        });
        await server.start();

        server.autoImplementApi(path.resolve(__dirname, '../api'))

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        })

        for (let i = 0; i < 10; ++i) {
            let promise = Promise.all(Array.from({ length: 10 }, () => new Promise<void>(rs => {
                let name = ['Req', 'InnerError', 'TsrpcError', 'error'][Math.random() * 4 | 0];
                let ret: any | undefined;
                let promise = client.callApi('Test', { name: name });
                let sn = client.lastSN;
                let abort = Math.random() > 0.5;
                if (abort) {
                    setTimeout(() => {
                        client.abort(sn)
                    }, 0);
                }
                promise.then(v => {
                    ret = v;
                });

                setTimeout(() => {
                    client.logger?.log('sn', sn, name, abort, ret)
                    if (abort) {
                        assert.strictEqual(ret, undefined);
                    }
                    else {
                        assert.notEqual(ret, undefined);
                        if (name === 'Req') {
                            assert.strictEqual(ret.isSucc, true);
                        }
                        else {
                            assert.strictEqual(ret.isSucc, false)
                        }
                    }
                    rs();
                }, 300)
            })));
            assert.strictEqual(client['_pendingApis'].length, 10);
            await promise;
            assert.strictEqual(client['_pendingApis'].length, 0);
        }

        await server.stop();
    })

    it('error', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger
        });
        await server.start();

        let client1 = new HttpClient(getProto(), {
            server: 'http://localhost:80',
            logger: clientLogger
        })

        let ret = await client1.callApi('Test', { name: 'xx' });
        console.log(ret);
        assert.strictEqual(ret.isSucc, false);
        assert.strictEqual(ret.err?.code, 'ECONNREFUSED');
        assert.strictEqual(ret.err?.type, TsrpcErrorType.NetworkError);

        await server.stop();
    })

    it('server timeout', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger,
            apiTimeout: 100
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

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        });
        let ret = await client.callApi('Test', { name: 'Jack' });
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('Server Timeout', {
                code: 'SERVER_TIMEOUT',
                type: TsrpcErrorType.ServerError
            })
        });

        await server.stop();
    });

    it('client timeout', async function () {
        let server1 = new HttpServer(getProto(), {
            logger: serverLogger
        });
        server1.implementApi('Test', call => {
            return new Promise(rs => {
                setTimeout(() => {
                    call.succ({
                        reply: 'Hello, ' + call.req.name
                    });
                    rs();
                }, 2000)
            })
        })
        await server1.start();

        let client = new HttpClient(getProto(), {
            timeout: 100,
            logger: clientLogger
        });

        let ret = await client.callApi('Test', { name: 'Jack123' });
        // SERVER TIMEOUT的call还没执行完，但是call却被放入Pool了，导致这个BUG
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError({
                message: 'Request Timeout',
                code: 'TIMEOUT',
                type: TsrpcErrorType.NetworkError
            })
        });
        await server1.stop();
    });

    it('Progressive stop', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger
        });

        let reqNum = 0;
        server.implementApi('Test', async call => {
            if (++reqNum === 10) {
                server.stop();
            }
            await new Promise(rs => setTimeout(rs, parseInt(call.req.name)));
            call.succ({ reply: 'OK' });
        });

        await server.start();
        let isStopped = false;

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        })

        let succNum = 0;
        await Promise.all(Array.from({ length: 10 }, (v, i) => client.callApi('Test', { name: '' + (i * 100) }).then(v => {
            if (v.res?.reply === 'OK') {
                ++succNum;
            }
        })))
        assert.strictEqual(succNum, 10);

        await server.stop();
    })
})

describe('HTTP Flows', function () {
    it('Server conn flow', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger
        });

        const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            assert.strictEqual((call.conn as any).xxxx, 'asdfasdf')
            assert.strictEqual(flowExecResult.postConnectFlow, true);
            assert.strictEqual(flowExecResult.postDisconnectFlow, undefined);
            call.succ({ reply: 'ok' });
            assert.strictEqual(flowExecResult.postDisconnectFlow, undefined);
        });

        server.flows.postConnectFlow.push(v => {
            flowExecResult.postConnectFlow = true;
            (v as any).xxxx = 'asdfasdf';
            return v;
        });
        server.flows.postDisconnectFlow.push(v => {
            flowExecResult.postDisconnectFlow = true;
            return v;
        })

        await server.start();

        assert.strictEqual(flowExecResult.postConnectFlow, undefined);
        assert.strictEqual(flowExecResult.postDisconnectFlow, undefined);

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        });
        await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.postConnectFlow, true);
        assert.strictEqual(flowExecResult.postDisconnectFlow, true);

        await server.stop();
    })

    it('Buffer enc/dec flow', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger
        });

        const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'Enc&Dec' });
        });

        server.flows.preRecvBufferFlow.push(v => {
            flowExecResult.preRecvBufferFlow = true;
            for (let i = 0; i < v.buf.length; ++i) {
                v.buf[i] ^= 128;
            }
            return v;
        });
        server.flows.preSendBufferFlow.push(v => {
            flowExecResult.preSendBufferFlow = true;
            for (let i = 0; i < v.buf.length; ++i) {
                v.buf[i] ^= 128;
            }
            return v;
        })

        await server.start();

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        });

        client.flows.preSendBufferFlow.push(v => {
            for (let i = 0; i < v.buf.length; ++i) {
                v.buf[i] ^= 128;
            }
            return v;
        });

        client.flows.preRecvBufferFlow.push(v => {
            for (let i = 0; i < v.buf.length; ++i) {
                v.buf[i] ^= 128;
            }
            return v;
        });

        let ret = await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.preRecvBufferFlow, true);
        assert.strictEqual(flowExecResult.preSendBufferFlow, true);
        assert.deepStrictEqual(ret, {
            isSucc: true,
            res: {
                reply: 'Enc&Dec'
            }
        })

        await server.stop();
    });

    it('ApiCall flow', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger
        });

        const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'asdgasdgasdgasdg' });
        });

        server.flows.preApiCallFlow.push(call => {
            assert.strictEqual(call.req.name, 'Changed')
            call.error('You need login');
            return call;
        });
        server.flows.postApiCallFlow.push(v => {
            flowExecResult.postApiCallFlow = true;
            return v;
        })

        await server.start();

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        });

        client.flows.preCallApiFlow.push(v => {
            v.req.name = 'Changed'
            return v;
        });

        let ret = await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.postApiCallFlow, true);
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('You need login')
        })

        await server.stop();
    });

    it('ApiCall flow break', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger
        });

        const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'asdgasdgasdgasdg' });
        });

        server.flows.preApiCallFlow.push(call => {
            assert.strictEqual(call.req.name, 'Changed')
            call.error('You need login');
            return undefined;
        });
        server.flows.postApiCallFlow.push(v => {
            flowExecResult.postApiCallFlow = true;
            return v;
        })

        await server.start();

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        });

        client.flows.preCallApiFlow.push(v => {
            v.req.name = 'Changed'
            return v;
        });

        let ret = await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.postApiCallFlow, undefined);
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('You need login')
        })

        await server.stop();
    });

    it('ApiCall flow error', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger
        });

        const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'asdgasdgasdgasdg' });
        });

        server.flows.preApiCallFlow.push(call => {
            assert.strictEqual(call.req.name, 'Changed')
            throw new Error('ASDFASDF')
        });
        server.flows.postApiCallFlow.push(v => {
            flowExecResult.postApiCallFlow = true;
            return v;
        })

        await server.start();

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        });

        client.flows.preCallApiFlow.push(v => {
            v.req.name = 'Changed'
            return v;
        });

        let ret = await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.postApiCallFlow, undefined);
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('Internal Server Error', {
                type: TsrpcErrorType.ServerError,
                innerErr: 'ASDFASDF',
                code: 'INTERNAL_ERR'
            })
        })

        await server.stop();
    });

    it('server ApiReturn flow', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger
        });

        const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'xxxxxxxxxxxxxxxxxxxx' });
        });

        server.flows.preApiReturnFlow.push(v => {
            flowExecResult.preApiReturnFlow = true;
            v.return = {
                isSucc: false,
                err: new TsrpcError('Ret changed')
            }
            return v;
        });
        server.flows.postApiReturnFlow.push(v => {
            flowExecResult.postApiReturnFlow = true;
            v.call.logger.log('RETTT', v.return);
            return v;
        })

        await server.start();

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        });


        let ret = await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.preApiReturnFlow, true);
        assert.strictEqual(flowExecResult.postApiReturnFlow, true);
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('Ret changed')
        })

        await server.stop();
    });

    it('client ApiReturn flow', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger
        });

        const flowExecResult: { [K in (keyof BaseClient<any>['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'xxxxxxxxxxxxxxxxxxxx' });
        });

        await server.start();

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        });

        client.flows.preApiReturnFlow.push(v => {
            flowExecResult.preApiReturnFlow = true;
            v.return = {
                isSucc: false,
                err: new TsrpcError('Ret changed')
            }
            return v;
        });
        client.flows.postApiReturnFlow.push(v => {
            flowExecResult.postApiReturnFlow = true;
            client.logger?.log('RETTT', v.return);
            return v;
        })

        let ret = await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.preApiReturnFlow, true);
        assert.strictEqual(flowExecResult.postApiReturnFlow, true);
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('Ret changed')
        })

        await server.stop();
    });

    it('client SendBufferFlow prevent', async function () {
        let server = new HttpServer(getProto(), {
            logger: serverLogger
        });

        // const flowExecResult: { [K in (keyof BaseClient<any>['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'xxxxxxxxxxxxxxxxxxxx' });
        });

        await server.start();

        let client = new HttpClient(getProto(), {
            logger: clientLogger
        });

        client.flows.preSendBufferFlow.push(v => {
            return undefined
        });

        let ret: any;
        client.callApi('Test', { name: 'xxx' }).then(v=>{ret = v});
        await new Promise(rs => { setTimeout(rs, 200) });
        assert.strictEqual(ret, undefined)

        await server.stop();
    });
})