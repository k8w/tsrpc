import assert from 'assert';
import { ObjectId } from 'bson';
import chalk from 'chalk';
import 'k8w-extend-native';
import * as path from "path";
import { HttpClient, HttpServer, TerminalColorLogger } from 'tsrpc';
import { PrefixLogger, ServiceProto, TsrpcError, TsrpcErrorType } from 'tsrpc-base';
import { BaseServer } from 'tsrpc-base-server';
import { ApiTest as ApiAbcTest } from '../api/a/b/c/ApiTest';
import { ApiTest } from '../api/ApiTest';
import { MsgChat } from '../proto/MsgChat';
import { serviceProto, ServiceType } from '../proto/serviceProto';

const serverLogger = {
    logger: new PrefixLogger({
        prefixs: [chalk.bgGreen.white(' Server ')],
        logger: new TerminalColorLogger({ pid: 'Server' })
    }),
    // logLevel: 'debug' as const,
    // debugBuf: true
};
const clientLogger = {
    logger: new PrefixLogger({
        prefixs: [chalk.bgBlue.white(' Client ')],
        logger: new TerminalColorLogger({ pid: 'Client' })
    }),
    // logLevel: 'debug',
    // debugBuf: true
}

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
            err: new TsrpcError('Remote internal error', {
                code: 'INTERNAL_ERR',
                type: TsrpcErrorType.RemoteError,
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
            ...serverLogger
        });
        await server.start();

        server.implementApi('Test', ApiTest as any);
        server.implementApi('a/b/c/Test', ApiAbcTest);

        let client = new HttpClient(getProto(), {
            ...clientLogger
        })

        await testApi(server, client);

        await server.stop();
    })

    // it('extend call in handler', function () {
    //     let server = new HttpServer(getProto(), {
    //         logger: serverLogger,
    //         logLevel: 'debug',
    //         debugBuf: true
    //     });

    //     type MyApiCall<Req, Res> = ApiCall<Req, Res> & {
    //         value1?: string;
    //         value2: string;
    //     }
    //     type MyMsgCall<Msg> = MsgCall<Msg> & {
    //         value1?: string;
    //         value2: string;
    //     }

    //     server.implementApi('Test', (call: MyApiCall<ReqTest, ResTest>) => {
    //         call.value1 = 'xxx';
    //         call.value2 = 'xxx';
    //     });
    //     server.listenMsg('Chat', (call: MyMsgCall<MsgChat>) => {
    //         call.msg.content;
    //         call.value1 = 'xxx';
    //         call.value2 = 'xxx';
    //     })
    // })

    // it('extend call in flow', function () {
    //     let server = new HttpServer(getProto(), {
    //         logger: serverLogger,
    //         logLevel: 'debug',
    //         debugBuf: true
    //     });

    //     type MyApiCall<Req, Res> = ApiCall<Req, Res> & {
    //         value1?: string;
    //         value2: string;
    //     }
    //     type MyMsgCall<Msg> = MsgCall<Msg> & {
    //         value1?: string;
    //         value2: string;
    //     }
    //     type MyConn = HttpConnection<any> & {
    //         currentUser: {
    //             uid: string,
    //             nickName: string
    //         }
    //     }

    //     server.flows.postConnectFlow.push((conn: MyConn) => {
    //         conn.currentUser.nickName = 'asdf';
    //         return conn;
    //     });
    //     server.flows.postConnectFlow.exec(null as any as MyConn, console);
    //     server.flows.preApiCallFlow.push((call: MyApiCall<any, any>) => {
    //         call.value2 = 'x';
    //         return call;
    //     });
    //     server.flows.preSendMsgFlow.push((call: MyMsgCall<any>) => {
    //         call.value2 = 'f';
    //         return call;
    //     })
    // })

    it('autoImplementApi', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger,
            apiCallTimeout: 5000
        });
        await server.start();

        server.autoImplementApi(path.resolve(__dirname, '../api'))

        let client = new HttpClient(getProto(), {
            ...clientLogger
        })

        await testApi(server, client);

        await server.stop();
    });

    it('sendMsg', async function () {
        let server = new HttpServer(getProto(), {
            port: 3001,
            ...serverLogger,
            // debugBuf: true
        });
        await server.autoImplementApi(path.resolve(__dirname, '../api'))
        await server.start();

        let client = new HttpClient(getProto(), {
            server: 'http://127.0.0.1:3001',
            ...clientLogger
        });

        return new Promise(rs => {
            let msg: MsgChat = {
                channel: 123,
                userName: 'fff',
                content: '666',
                time: Date.now()
            };

            server.onMsg('Chat', async msg1 => {
                assert.deepStrictEqual(msg1, msg);
                await server.stop();
                rs();
            });

            client.sendMsg('Chat', msg);
        })
    })

    it('Same-name msg and api', async function () {
        let server = new HttpServer(getProto(), {
            port: 3001,
            ...serverLogger
        });

        await server.autoImplementApi(path.resolve(__dirname, '../api'))
        await server.start();

        let client = new HttpClient(getProto(), {
            server: 'http://127.0.0.1:3001',
            ...clientLogger
        });

        let ret = await client.callApi('Test', { name: 'xxx' });
        assert.ok(ret.isSucc);

        return new Promise(rs => {
            server.onMsg('Test', async msg => {
                assert.deepStrictEqual(msg, { content: 'abc' });
                await server.stop();
                rs();
            });

            client.sendMsg('Test', {
                content: 'abc'
            });
        })
    });

    it('abort', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });
        await server.start();

        server.autoImplementApi(path.resolve(__dirname, '../api'))

        let client = new HttpClient(getProto(), {
            ...clientLogger
        })

        let result: any | undefined;
        let promise = client.callApi('Test', { name: 'aaaaaaaa' });
        let sn = client.lastSn;
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

    it('abortByKey', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });
        await server.start();

        server.autoImplementApi(path.resolve(__dirname, '../api'))

        let client = new HttpClient(getProto(), {
            ...clientLogger
        })

        let result: any | undefined;
        let result1: any | undefined;

        client.callApi('Test', { name: 'aaaaaaaa' }, { abortKey: 'XXX' }).then(v => { result = v; });
        client.callApi('Test', { name: 'aaaaaaaa' }, { abortKey: 'XXX' }).then(v => { result = v; });
        client.callApi('Test', { name: 'aaaaaaaa' }, { abortKey: 'XXX' }).then(v => { result = v; });
        client.callApi('Test', { name: 'aaaaaaaa' }, { abortKey: 'XXX' }).then(v => { result = v; });
        client.callApi('Test', { name: 'aaaaaaaa' }, { abortKey: 'XXX' }).then(v => { result = v; });

        client.callApi('Test', { name: 'bbbbbb' }).then(v => { result1 = v; });

        setTimeout(() => {
            client.abortByKey('XXX')
        }, 10);

        await new Promise<void>(rs => {
            setTimeout(() => {
                assert.strictEqual(result, undefined);
                assert.deepStrictEqual(result1, {
                    isSucc: true,
                    res: {
                        reply: 'Test reply: bbbbbb'
                    }
                })
                rs();
            }, 150)
        })

        await server.stop();
    })

    it('abortAll', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });
        await server.start();

        server.autoImplementApi(path.resolve(__dirname, '../api'))

        let client = new HttpClient(getProto(), {
            ...clientLogger
        })

        let result: any | undefined;
        let result1: any | undefined;

        client.callApi('Test', { name: 'aaaaaaaa' }, { abortKey: 'XXX' }).then(v => { result = v; });
        client.callApi('Test', { name: 'aaaaaaaa' }, { abortKey: 'XXX' }).then(v => { result = v; });
        client.callApi('Test', { name: 'aaaaaaaa' }, { abortKey: 'XXX' }).then(v => { result = v; });
        client.callApi('Test', { name: 'aaaaaaaa' }, { abortKey: 'XXX' }).then(v => { result = v; });
        client.callApi('Test', { name: 'aaaaaaaa' }, { abortKey: 'XXX' }).then(v => { result = v; });

        client.callApi('Test', { name: 'bbbbbb' }).then(v => { result1 = v; });

        setTimeout(() => {
            client.abortAll()
        }, 10);

        await new Promise<void>(rs => {
            setTimeout(() => {
                assert.strictEqual(result, undefined);
                assert.strictEqual(result1, undefined);
                rs();
            }, 150)
        })

        await server.stop();
    })

    it('pendingApis', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });
        await server.start();

        server.autoImplementApi(path.resolve(__dirname, '../api'))

        let client = new HttpClient(getProto(), {
            ...clientLogger
        })

        for (let i = 0; i < 10; ++i) {
            let promise = Promise.all(Array.from({ length: 10 }, () => new Promise<void>(rs => {
                let name = ['Req', 'InnerError', 'TsrpcError', 'error'][Math.random() * 4 | 0];
                let ret: any | undefined;
                let promise = client.callApi('Test', { name: name });
                let sn = client.lastSn;
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
            assert.strictEqual(client['_pendingCallApis'].size, 10);
            await promise;
            assert.strictEqual(client['_pendingCallApis'].size, 0);
        }

        await server.stop();
    })

    it('error', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });
        await server.start();

        let client1 = new HttpClient(getProto(), {
            server: 'http://localhost:80',
            ...clientLogger
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
            ...serverLogger,
            apiCallTimeout: 100
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
            ...clientLogger
        });
        let ret = await client.callApi('Test', { name: 'Jack' });
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('Remote Timeout', {
                code: 'REMOTE_TIMEOUT',
                type: TsrpcErrorType.RemoteError
            })
        });

        await server.stop();
    });

    it('client timeout', async function () {
        let server1 = new HttpServer(getProto(), {
            ...serverLogger
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
            callApiTimeout: 100,
            ...clientLogger
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

    it('Graceful stop', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });

        server.implementApi('Test', async call => {
            await new Promise(rs => setTimeout(rs, parseInt(call.req.name)));
            call.succ({ reply: 'OK' });
        });

        await server.start();

        let client = new HttpClient(getProto(), {
            ...clientLogger
        })

        let promiseStop!: Promise<void>;
        setTimeout(() => {
            promiseStop = server.stop(2000);
        }, 50)

        let succNum = 0;
        await Promise.all(Array.from({ length: 10 }, (v, i) => client.callApi('Test', { name: '' + (i * 100) }).then(v => {
            if (v.res?.reply === 'OK') {
                ++succNum;
            }
        })))

        assert.strictEqual(succNum, 10);
        await promiseStop;
    })
})

describe('HTTP Flows', function () {
    it('Server conn flow', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
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
            ...clientLogger
        });
        await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.postConnectFlow, true);
        assert.strictEqual(flowExecResult.postDisconnectFlow, true);

        await server.stop();
    })

    it('Buffer enc/dec flow', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });

        const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'Enc&Dec' });
        });

        server.flows.preRecvDataFlow.push(v => {
            if (v.data instanceof Uint8Array) {
                flowExecResult.preRecvBufferFlow = true;
                for (let i = 0; i < v.data.length; ++i) {
                    v.data[i] ^= 128;
                }
            }
            return v;
        });
        server.flows.preSendDataFlow.push(v => {
            if (v.data instanceof Uint8Array) {
                flowExecResult.preSendBufferFlow = true;
                for (let i = 0; i < v.data.length; ++i) {
                    v.data[i] ^= 128;
                }
            }

            return v;
        })

        await server.start();

        let client = new HttpClient(getProto(), {
            ...clientLogger
        });

        client.flows.preSendDataFlow.push(v => {
            if (v.data instanceof Uint8Array) {
                for (let i = 0; i < v.data.length; ++i) {
                    v.data[i] ^= 128;
                }
            }
            return v;
        });

        client.flows.preRecvDataFlow.push(v => {
            if (v.data instanceof Uint8Array) {
                for (let i = 0; i < v.data.length; ++i) {
                    v.data[i] ^= 128;
                }
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
            ...serverLogger
        });

        const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'asdgasdgasdgasdg' });
        });

        server.flows.preApiCallFlow.push(call => {
            if (call.apiName === 'Test') {
                assert.strictEqual(call.req.name, 'Changed')
                call.error('You need login');
            }
            return call;
        });
        server.flows.postApiCallReturnFlow.push(v => {
            flowExecResult.postApiCallReturnFlow = true;
            return v;
        })

        await server.start();

        let client = new HttpClient(getProto(), {
            ...clientLogger
        });

        client.flows.preCallApiFlow.push(v => {
            if (v.apiName !== 'ObjId') {
                v.req.name = 'Changed'
            }
            return v;
        });

        let ret = await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.postApiCallReturnFlow, true);
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('You need login')
        })

        await server.stop();
    });

    it('ApiCall flow break', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });

        const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'asdgasdgasdgasdg' });
        });

        server.flows.preApiCallFlow.push(call => {
            if (call.apiName === 'Test') {
                assert.strictEqual(call.req.name, 'Changed')
                call.error('You need login');
            }
            return undefined;
        });
        server.flows.postApiCallReturnFlow.push(v => {
            flowExecResult.postApiCallReturnFlow = true;
            return v;
        })

        await server.start();

        let client = new HttpClient(getProto(), {
            ...clientLogger
        });

        client.flows.preCallApiFlow.push(v => {
            if (v.apiName !== 'ObjId') {
                v.req.name = 'Changed'
            }
            return v;
        });

        let ret = await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.postApiCallReturnFlow, true);
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('You need login')
        })

        await server.stop();
    });

    it('ApiCall flow error', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });

        const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'asdgasdgasdgasdg' });
        });

        server.flows.preApiCallFlow.push(call => {
            if (call.apiName === 'Test') {
                assert.strictEqual(call.req.name, 'Changed')
                throw new Error('ASDFASDF')
            }
            return call;
        });
        server.flows.postApiCallReturnFlow.push(v => {
            flowExecResult.postApiCallReturnFlow = true;
            return v;
        })

        await server.start();

        let client = new HttpClient(getProto(), {
            ...clientLogger
        });

        client.flows.preCallApiFlow.push(v => {
            if (v.apiName !== 'ObjId') {
                v.req.name = 'Changed'
            }
            return v;
        });

        let ret = await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.postApiCallReturnFlow, true);
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('Remote internal error', {
                type: TsrpcErrorType.RemoteError,
                innerErr: 'ASDFASDF',
                code: 'INTERNAL_ERR'
            })
        })

        await server.stop();
    });

    it('server ApiReturn flow', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });

        const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'xxxxxxxxxxxxxxxxxxxx' });
        });

        server.flows.preApiCallReturnFlow.push(v => {
            flowExecResult.preApiCallReturnFlow = true;
            v.return = {
                isSucc: false,
                err: new TsrpcError('Ret changed')
            }
            return v;
        });
        server.flows.postApiCallReturnFlow.push(call => {
            flowExecResult.postApiCallReturnFlow = true;
            call.logger.log('RETTT', call.return);
            return call;
        })

        await server.start();

        let client = new HttpClient(getProto(), {
            ...clientLogger
        });


        let ret = await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.preApiCallReturnFlow, true);
        assert.strictEqual(flowExecResult.postApiCallReturnFlow, true);
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('Ret changed')
        })

        await server.stop();
    });

    it('client ApiReturn flow', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });

        const flowExecResult: { [K in (keyof HttpClient<any>['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'xxxxxxxxxxxxxxxxxxxx' });
        });

        await server.start();

        let client = new HttpClient(getProto(), {
            ...clientLogger
        });

        client.flows.preCallApiReturnFlow.push(v => {
            flowExecResult.preCallApiReturnFlow = true;
            v.return = {
                isSucc: false,
                err: new TsrpcError('Ret changed')
            }
            return v;
        });

        let ret = await client.callApi('Test', { name: 'xxx' });
        assert.strictEqual(flowExecResult.preCallApiReturnFlow, true);
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('Ret changed')
        })

        await server.stop();
    });

    it('client SendDataFlow prevent', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });

        // const flowExecResult: { [K in (keyof BaseClient<any>['flows'])]?: boolean } = {};

        server.implementApi('Test', async call => {
            call.succ({ reply: 'xxxxxxxxxxxxxxxxxxxx' });
        });

        await server.start();

        let client = new HttpClient(getProto(), {
            ...clientLogger
        });

        client.flows.preSendDataFlow.push(v => {
            return undefined
        });

        let ret: any;
        client.callApi('Test', { name: 'xxx' }).then(v => { ret = v });
        await new Promise(rs => { setTimeout(rs, 200) });
        assert.strictEqual(ret, undefined)

        await server.stop();
    });

    it('onInputBufferError', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });
        await server.start();

        let client = new HttpClient(getProto(), {
            ...clientLogger
        });
        client.flows.preSendDataFlow.push(v => {
            if (v.data instanceof Uint8Array) {
                for (let i = 0; i < v.data.length; ++i) {
                    v.data[i] += 1;
                }
            }

            return v;
        });

        let ret = await client.callApi('Test', { name: 'XXX' });
        assert.deepStrictEqual(ret, {
            isSucc: false,
            err: new TsrpcError('Unknown buffer encoding', {
                type: TsrpcErrorType.RemoteError
            })
        })

        await server.stop();
    })

    it('ObjectId', async function () {
        let server = new HttpServer(getProto(), {
            ...serverLogger
        });
        server.autoImplementApi(path.resolve(__dirname, '../api'))
        await server.start();

        let client = new HttpClient(getProto(), {
            ...clientLogger
        });

        // ObjectId
        let objId1 = new ObjectId();
        let ret = await client.callApi('ObjId', {
            id1: objId1
        });
        assert.strictEqual(ret.isSucc, true, ret.err?.message);
        assert.strictEqual(objId1.toString(), ret.res!.id2.toString());

        await server.stop();
    })
})