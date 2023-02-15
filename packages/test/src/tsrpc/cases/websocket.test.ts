import assert from 'assert';
import chalk from 'chalk';
import path from 'path';
import {
  TerminalColorLogger,
  WebSocketClient,
  WebSocketServer,
  WebSocketServerConnection,
} from 'tsrpc';
import {
  PrefixLogger,
  ServiceProto,
  TsrpcError,
  TsrpcErrorType,
} from 'tsrpc-base';
import { ApiTest as ApiAbcTest } from '../api/a/b/c/ApiTest';
import { ApiTest } from '../api/ApiTest';
import { MsgChat } from '../proto/MsgChat';
import { serviceProto, ServiceType } from '../proto/serviceProto';

const serverLogger = new PrefixLogger({
  prefixs: [chalk.bgGreen.white(' Server ')],
  logger: new TerminalColorLogger({ pid: 'Server' }),
});
const clientLogger = new PrefixLogger({
  prefixs: [chalk.bgBlue.white(' Client ')],
  logger: new TerminalColorLogger({ pid: 'Client' }),
});

const getProto = () =>
  Object.merge({}, serviceProto) as ServiceProto<ServiceType>;

async function testApi(
  server: WebSocketServer<ServiceType>,
  client: WebSocketClient<ServiceType>
) {
  // Succ
  assert.deepStrictEqual(
    await client.callApi('Test', {
      name: 'Req1',
    }),
    {
      isSucc: true,
      res: {
        reply: 'Test reply: Req1',
      },
    }
  );
  assert.deepStrictEqual(
    await client.callApi('a/b/c/Test', {
      name: 'Req2',
    }),
    {
      isSucc: true,
      res: {
        reply: 'a/b/c/Test reply: Req2',
      },
    }
  );

  // Inner error
  for (let v of ['Test', 'a/b/c/Test']) {
    let ret = await client.callApi(v as any, {
      name: 'InnerError',
    });
    delete ret.err!.innerErr.stack;

    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError('Remote internal error', {
        code: 'INTERNAL_ERR',
        type: TsrpcErrorType.ServerError,
        innerErr: `${v} InnerError`,
      }),
    });
  }

  // TsrpcError
  for (let v of ['Test', 'a/b/c/Test']) {
    let ret = await client.callApi(v as any, {
      name: 'TsrpcError',
    });
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError(`${v} TsrpcError`, {
        code: 'CODE_TEST',
        type: TsrpcErrorType.ApiError,
        info: 'ErrInfo ' + v,
      }),
    });
  }

  // call.error
  for (let v of ['Test', 'a/b/c/Test']) {
    let ret = await client.callApi(v as any, {
      name: 'error',
    });
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError('Got an error', {
        type: TsrpcErrorType.ApiError,
      }),
    });
  }
}

describe('WS Server & Client basic', function () {
  it('cannot callApi before connect', async function () {
    let client = new WebSocketClient(getProto(), {
      logger: clientLogger,
      debugBuf: true,
    });
    let res = await client.callApi('Test', { name: 'xxx' });
    assert.deepStrictEqual(res, {
      isSucc: false,
      err: new TsrpcError(
        "The client is not connected, please call 'client.connect()' first.",
        {
          type: TsrpcErrorType.LocalError,
        }
      ),
    });
  });

  it('implement API manually', async function () {
    let server = new WebSocketServer(getProto(), {
      logger: serverLogger,
      debugBuf: true,
    });
    await server.start();

    server.implementApi('Test', ApiTest);
    server.implementApi('a/b/c/Test', ApiAbcTest);

    let client = new WebSocketClient(getProto(), {
      logger: clientLogger,
      debugBuf: true,
    });
    await client.connect();

    await testApi(server, client);

    await server.stop();
  });

  it('extend conn', function () {
    let server = new WebSocketServer(getProto(), {
      logger: serverLogger,
      debugBuf: true,
    });
    type MyConn = WebSocketServerConnection<ServiceType> & {
      sessionData: {
        value: string;
      };
    };
    server.flows.postConnectFlow.push((conn: MyConn) => {
      conn.sessionData.value = 'zxcdv';
      return conn;
    });
  });

  it('autoImplementApi', async function () {
    let server = new WebSocketServer(getProto(), {
      logger: serverLogger,
      apiCallTimeout: 5000,
    });
    await server.start();

    server.autoImplementApi(path.resolve(__dirname, '../api'));

    let client = new WebSocketClient(getProto(), {
      logger: clientLogger,
    });
    await client.connect();

    await testApi(server, client);

    await server.stop();
  });

  it('sendMsg', async function () {
    let server = new WebSocketServer(getProto(), {
      port: 3001,
      logger: serverLogger,
      // debugBuf: true
    });

    await server.start();

    let client = new WebSocketClient(getProto(), {
      server: 'ws://127.0.0.1:3001',
      logger: clientLogger,
      // debugBuf: true
    });
    await client.connect();

    return new Promise((rs) => {
      let msg: MsgChat = {
        channel: 123,
        userName: 'fff',
        content: '666',
        time: Date.now(),
      };

      server.onMsg('Chat', async (msg1) => {
        assert.deepStrictEqual(msg1, msg);
        await server.stop();
        rs();
      });

      client.sendMsg('Chat', msg);
    });
  });

  it('Same-name msg and api', async function () {
    let server = new WebSocketServer(getProto(), {
      port: 3000,
      logger: serverLogger,
      // debugBuf: true
    });

    await server.autoImplementApi(path.resolve(__dirname, '../api'));
    await server.start();

    let client = new WebSocketClient(getProto(), {
      server: 'ws://127.0.0.1:3000',
      logger: clientLogger,
      // debugBuf: true
    });
    await client.connect();

    let ret = await client.callApi('Test', { name: 'xxx' });
    assert.ok(ret.isSucc);

    await new Promise<void>((rs) => {
      server.onMsg('Test', async (msg1) => {
        assert.deepStrictEqual(msg1, { content: 'abc' });
        rs();
      });

      client.sendMsg('Test', {
        content: 'abc',
      });
    });

    await new Promise<void>((rs) => {
      client.onMsg('Test', async (msg) => {
        assert.deepStrictEqual(msg, { content: 'abc' });
        rs();
      });

      Array.from(server.connections)[0].sendMsg('Test', {
        content: 'abc',
      });
    });

    await server.stop();
  });

  it('server send msg', async function () {
    let server = new WebSocketServer(getProto(), {
      port: 3001,
      logger: serverLogger,
      // debugBuf: true
    });

    await server.start();

    let client = new WebSocketClient(getProto(), {
      server: 'ws://127.0.0.1:3001',
      logger: clientLogger,
      // debugBuf: true
    });
    await client.connect();

    return new Promise((rs) => {
      let msg: MsgChat = {
        channel: 123,
        userName: 'fff',
        content: '666',
        time: Date.now(),
      };

      client.onMsg('Chat', async (msg1) => {
        assert.deepStrictEqual(msg1, msg);
        await server.stop();
        rs();
      });

      Array.from(server.connections)[0].sendMsg('Chat', msg);
    });
  });

  it('listen msg by regexp', async function () {
    let server = new WebSocketServer(getProto(), {
      port: 3001,
      logger: serverLogger,
      // debugBuf: true
    });

    await server.start();

    let client = new WebSocketClient(getProto(), {
      server: 'ws://127.0.0.1:3001',
      logger: clientLogger,
      // debugBuf: true
    });
    await client.connect();

    return new Promise((rs) => {
      let msg: MsgChat = {
        channel: 123,
        userName: 'fff',
        content: '666',
        time: Date.now(),
      };

      client.onMsg(/.*/, async (msg1, msgName) => {
        assert.deepStrictEqual(msg1, msg);
        assert.deepStrictEqual(msgName, 'Chat');
        await server.stop();
        rs();
      });

      Array.from(server.connections)[0].sendMsg('Chat', msg);
    });
  });

  it('server broadcast msg', async function () {
    let server = new WebSocketServer(getProto(), {
      port: 3001,
      logger: serverLogger,
      // debugBuf: true
    });

    await server.start();

    let client1 = new WebSocketClient(getProto(), {
      server: 'ws://127.0.0.1:3001',
      logger: clientLogger,
      // debugBuf: true
    });
    let client2 = new WebSocketClient(getProto(), {
      server: 'ws://127.0.0.1:3001',
      logger: clientLogger,
      // debugBuf: true
    });
    await client1.connect();
    await client2.connect();

    let msg: MsgChat = {
      channel: 123,
      userName: 'fff',
      content: '666',
      time: Date.now(),
    };

    await new Promise<void>((rs) => {
      let recvClients: WebSocketClient<any>[] = [];
      let msgHandler = async (
        client: WebSocketClient<any>,
        msg1: MsgChat,
        msgName: string
      ) => {
        recvClients.push(client);
        assert.deepStrictEqual(msg1, msg);
        assert.deepStrictEqual(msgName, 'Chat');
        if (
          recvClients.some((v) => v === client1) &&
          recvClients.some((v) => v === client2)
        ) {
          client1.unlistenMsgAll('Chat');
          client2.unlistenMsgAll('Chat');
          rs();
        }
      };

      client1.listenMsg('Chat', msgHandler.bind(null, client1));
      client2.listenMsg('Chat', msgHandler.bind(null, client2));

      server.broadcastMsg('Chat', msg);
    });

    await new Promise<void>((rs) => {
      let recvClients: WebSocketClient<any>[] = [];
      let msgHandler = async (
        client: WebSocketClient<any>,
        msg1: MsgChat,
        msgName: string
      ) => {
        recvClients.push(client);
        assert.deepStrictEqual(msg1, msg);
        assert.deepStrictEqual(msgName, 'Chat');
        if (
          recvClients.some((v) => v === client1) &&
          recvClients.some((v) => v === client2)
        ) {
          await server.stop();
          rs();
        }
      };

      client1.listenMsg('Chat', msgHandler.bind(null, client1));
      client2.listenMsg('Chat', msgHandler.bind(null, client2));

      server.broadcastMsg('Chat', msg, Array.from(server.connections));
    });
  });

  it('abort', async function () {
    let server = new WebSocketServer(getProto(), {
      logger: serverLogger,
    });
    await server.start();

    server.autoImplementApi(path.resolve(__dirname, '../api'));

    let client = new WebSocketClient(getProto(), {
      logger: clientLogger,
    });
    await client.connect();

    let result: any | undefined;
    let promise = client.callApi('Test', { name: 'aaaaaaaa' });
    let sn = client.lastSn;
    setTimeout(() => {
      client.abort(sn);
    }, 10);
    promise.then((v) => {
      result = v;
    });

    await new Promise<void>((rs) => {
      setTimeout(() => {
        assert.strictEqual(result, undefined);
        rs();
      }, 150);
    });

    await server.stop();
  });

  it('pendingApis', async function () {
    let server = new WebSocketServer(getProto(), {
      logger: serverLogger,
    });
    await server.start();

    server.autoImplementApi(path.resolve(__dirname, '../api'));

    let client = new WebSocketClient(getProto(), {
      logger: clientLogger,
    });
    await client.connect();

    for (let i = 0; i < 10; ++i) {
      let promise = Promise.all(
        Array.from(
          { length: 10 },
          () =>
            new Promise<void>((rs) => {
              let name = ['Req', 'InnerError', 'TsrpcError', 'error'][
                (Math.random() * 4) | 0
              ];
              let ret: any | undefined;
              let promise = client.callApi('Test', { name: name });
              let sn = client.lastSn;
              let abort = Math.random() > 0.5;
              if (abort) {
                setTimeout(() => {
                  client.abort(sn);
                }, 0);
              }
              promise.then((v) => {
                ret = v;
              });

              setTimeout(() => {
                client.logger?.info('sn', sn, name, abort, ret);
                if (abort) {
                  assert.strictEqual(ret, undefined);
                } else {
                  assert.notEqual(ret, undefined);
                  if (name === 'Req') {
                    assert.strictEqual(ret.isSucc, true);
                  } else {
                    assert.strictEqual(ret.isSucc, false);
                  }
                }
                rs();
              }, 300);
            })
        )
      );
      assert.strictEqual(client['_pendingCallApis'].size, 10);
      await promise;
      assert.strictEqual(client['_pendingCallApis'].size, 0);
    }

    await server.stop();
  });

  it('error', async function () {
    let server = new WebSocketServer(getProto(), {
      logger: serverLogger,
    });
    await server.start();

    let client1 = new WebSocketClient(getProto(), {
      server: 'ws://localhost:80',
      logger: clientLogger,
    });
    let res = await client1.connect();
    assert.strictEqual(res.isSucc, false);

    let ret = await client1.callApi('Test', { name: 'xx' });
    console.log(ret);
    assert.strictEqual(ret.isSucc, false);
    assert.strictEqual(ret.err?.type, TsrpcErrorType.LocalError);

    await server.stop();
  });

  it('server callApiTimeout', async function () {
    let server = new WebSocketServer(getProto(), {
      logger: serverLogger,
      apiCallTimeout: 100,
    });
    server.implementApi('Test', (call) => {
      return new Promise((rs) => {
        setTimeout(() => {
          call.req &&
            call.succ({
              reply: 'Hi, ' + call.req.name,
            });
          rs();
        }, 200);
      });
    });
    await server.start();

    let client = new WebSocketClient(getProto(), {
      logger: clientLogger,
    });
    await client.connect();
    let ret = await client.callApi('Test', { name: 'Jack' });
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError('Remote Timeout', {
        code: 'REMOTE_TIMEOUT',
        type: TsrpcErrorType.RemoteError,
      }),
    });

    await server.stop();
  });

  it('client callApiTimeout', async function () {
    let server1 = new WebSocketServer(getProto(), {
      logger: serverLogger,
    });
    server1.implementApi('Test', (call) => {
      return new Promise((rs) => {
        setTimeout(() => {
          call.succ({
            reply: 'Hello, ' + call.req.name,
          });
          rs();
        }, 2000);
      });
    });
    await server1.start();

    let client = new WebSocketClient(getProto(), {
      callApiTimeout: 100,
      logger: clientLogger,
    });
    await client.connect();

    let ret = await client.callApi('Test', { name: 'Jack123' });
    // SERVER TIMEOUT的call还没执行完，但是call却被放入Pool了，导致这个BUG
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError({
        message: 'Request Timeout',
        code: 'TIMEOUT',
        type: TsrpcErrorType.NetworkError,
      }),
    });
    await server1.stop();
  });

  it('Graceful stop', async function () {
    let server = new WebSocketServer(getProto(), {
      logger: serverLogger,
    });

    let reqNum = 0;
    server.implementApi('Test', async (call) => {
      if (++reqNum === 10) {
        server.stop(2000);
      }
      await new Promise((rs) => setTimeout(rs, parseInt(call.req.name)));
      call.succ({ reply: 'OK' });
    });

    await server.start();
    let isStopped = false;

    let client = new WebSocketClient(getProto(), {
      logger: clientLogger,
    });
    await client.connect();

    let succNum = 0;
    await Promise.all(
      Array.from({ length: 10 }, (v, i) =>
        client.callApi('Test', { name: '' + i * 100 }).then((v) => {
          console.log('xxx', v);
          if (v.res?.reply === 'OK') {
            ++succNum;
          }
        })
      )
    );
    assert.strictEqual(succNum, 10);
  });

  // it('Client heartbeat works', async function () {
  //     let server = new WebSocketServer(getProto(), {
  //         port: 3001,
  //         logger: serverLogger,
  //         debugBuf: true
  //     });
  //     await server.start();

  //     let client = new WebSocketClient(getProto(), {
  //         server: 'ws://127.0.0.1:3001',
  //         logger: clientLogger,
  //         heartbeat: true,
  //         heartbeatRecvTimeout: 500,
  //         heartbeatSendInterval: 200,
  //         debugBuf: true
  //     });
  //     await client.connect();

  //     await new Promise(rs => { setTimeout(rs, 2000) });

  //     // 人为制造一个延迟
  //     for (let i = 0; i < 100000; ++i) {
  //         let a = {};
  //     }

  //     client.logger?.info('lastHeartbeatLatency', client.lastHeartbeatLatency);
  //     assert.strictEqual(client.status, ConnectionStatus.Connected)
  //     assert.ok(client.lastHeartbeatLatency > 0, `client.lastHeartbeatLatency = ${client.lastHeartbeatLatency}`);

  //     await client.disconnect();
  //     await server.stop();
  // })

  // it('Client heartbeat error', async function () {
  //     let server = new WebSocketServer(getProto(), {
  //         port: 3001,
  //         logger: serverLogger,
  //         debugBuf: true
  //     });
  //     await server.start();

  //     let client = new WebSocketClient(getProto(), {
  //         server: 'ws://127.0.0.1:3001',
  //         logger: clientLogger,
  //         heartbeat: true,
  //         heartbeatRecvTimeout: 1000,
  //         heartbeatSendInterval: 1000,
  //         debugBuf: true
  //     });

  //     let disconnectFlowData: { isManual?: boolean } | undefined;
  //     client.flows.postDisconnectFlow.push(v => {
  //         disconnectFlowData = {}
  //         return v;
  //     })

  //     await client.connect();

  //     const temp = TransportDataUtil.HeartbeatPacket;
  //     (TransportDataUtil as any).HeartbeatPacket = new Uint8Array([0, 0]);

  //     await new Promise(rs => { setTimeout(rs, 2000) });
  //     client.logger?.info('lastHeartbeatLatency', client.lastHeartbeatLatency);
  //     assert.strictEqual(client.status, WebSocketClientStatus.Closed)
  //     assert.deepStrictEqual(disconnectFlowData, {})

  //     await client.disconnect();
  //     await server.stop();
  //     (TransportDataUtil as any).HeartbeatPacket = temp;
  // })

  // it('Server heartbeat kick', async function () {
  //     let server = new WebSocketServer(getProto(), {
  //         port: 3001,
  //         logger: serverLogger,
  //         debugBuf: true,
  //         heartbeatWaitTime: 1000
  //     });
  //     await server.start();

  //     let client = new WebSocketClient(getProto(), {
  //         server: 'ws://127.0.0.1:3001',
  //         logger: clientLogger,
  //         debugBuf: true
  //     });

  //     let disconnectFlowData: { isManual?: boolean } | undefined;
  //     client.flows.postDisconnectFlow.push(v => {
  //         disconnectFlowData = {}
  //         return v;
  //     })

  //     await client.connect();

  //     await new Promise(rs => { setTimeout(rs, 2000) });
  //     assert.strictEqual(client.status, WebSocketClientStatus.Closed)
  //     assert.deepStrictEqual(disconnectFlowData, {})

  //     await client.disconnect();
  //     await server.stop();
  // })
});

// describe('WS Flows', function () {
//     it('Server conn flow', async function () {
//         let server = new WebSocketServer(getProto(), {
//             logger: serverLogger
//         });

//         const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

//         server.implementApi('Test', async call => {
//             assert.strictEqual((call.conn as any).xxxx, 'asdfasdf')
//             assert.strictEqual(flowExecResult.postConnectFlow, true);
//             assert.strictEqual(flowExecResult.postDisconnectFlow, undefined);
//             call.succ({ reply: 'ok' });
//             assert.strictEqual(flowExecResult.postDisconnectFlow, undefined);
//         });

//         server.flows.postConnectFlow.push(v => {
//             flowExecResult.postConnectFlow = true;
//             (v as any).xxxx = 'asdfasdf';
//             return v;
//         });
//         server.flows.postDisconnectFlow.push(v => {
//             server.logger.info('server postDisconnectFlow')
//             flowExecResult.postDisconnectFlow = true;
//             return v;
//         })

//         await server.start();

//         assert.strictEqual(flowExecResult.postConnectFlow, undefined);
//         assert.strictEqual(flowExecResult.postDisconnectFlow, undefined);

//         let client = new WebSocketClient(getProto(), {
//             logger: clientLogger
//         });
//         await client.connect();
//         await client.callApi('Test', { name: 'xxx' });
//         assert.strictEqual(flowExecResult.postConnectFlow, true);
//         await server.stop();
//         assert.strictEqual(flowExecResult.postDisconnectFlow, true);
//     })

//     it('Buffer enc/dec flow', async function () {
//         let server = new WebSocketServer(getProto(), {
//             logger: serverLogger,
//             debugBuf: true
//         });

//         const flowExecResult: { [key: string]: boolean } = {};

//         server.implementApi('Test', async call => {
//             call.succ({ reply: 'Enc&Dec' });
//         });

//         server.flows.preRecvBufferFlow.push(v => {
//             flowExecResult.preRecvBufferFlow = true;
//             for (let i = 0; i < v.buf.length; ++i) {
//                 v.buf[i] ^= 128;
//             }
//             return v;
//         });
//         server.flows.preSendBufferFlow.push(v => {
//             flowExecResult.preSendBufferFlow = true;
//             for (let i = 0; i < v.buf.length; ++i) {
//                 v.buf[i] ^= 128;
//             }
//             return v;
//         })

//         await server.start();

//         let client = new WebSocketClient(getProto(), {
//             logger: clientLogger,
//             debugBuf: true
//         });
//         await client.connect();

//         client.flows.preSendBufferFlow.push(v => {
//             flowExecResult.client_preSendBufferFlow = true;
//             for (let i = 0; i < v.buf.length; ++i) {
//                 v.buf[i] ^= 128;
//             }
//             return v;
//         });

//         client.flows.preRecvBufferFlow.push(v => {
//             flowExecResult.client_preRecvBufferFlow = true;
//             for (let i = 0; i < v.buf.length; ++i) {
//                 v.buf[i] ^= 128;
//             }
//             return v;
//         });

//         let ret = await client.callApi('Test', { name: 'xxx' });
//         assert.strictEqual(flowExecResult.client_preSendBufferFlow, true);
//         assert.strictEqual(flowExecResult.client_preRecvBufferFlow, true);
//         assert.strictEqual(flowExecResult.preRecvBufferFlow, true);
//         assert.strictEqual(flowExecResult.preSendBufferFlow, true);
//         assert.deepStrictEqual(ret, {
//             isSucc: true,
//             res: {
//                 reply: 'Enc&Dec'
//             }
//         })

//         await server.stop();
//     });

//     it('ApiCall flow', async function () {
//         let server = new WebSocketServer(getProto(), {
//             logger: serverLogger
//         });

//         const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

//         server.implementApi('Test', async call => {
//             call.succ({ reply: 'asdgasdgasdgasdg' });
//         });

//         server.flows.preApiCallFlow.push(call => {
//             assert.strictEqual(call.req.name, 'Changed')
//             call.error('You need login');
//             return call;
//         });
//         server.flows.postApiCallFlow.push(v => {
//             flowExecResult.postApiCallFlow = true;
//             return v;
//         })

//         await server.start();

//         let client = new WebSocketClient(getProto(), {
//             logger: clientLogger
//         });
//         await client.connect();

//         client.flows.preCallApiFlow.push(v => {
//             if (v.apiName !== 'ObjId') {
//                 v.req.name = 'Changed'
//             }
//             return v;
//         });

//         let ret = await client.callApi('Test', { name: 'xxx' });
//         assert.strictEqual(flowExecResult.postApiCallFlow, true);
//         assert.deepStrictEqual(ret, {
//             isSucc: false,
//             err: new TsrpcError('You need login')
//         })

//         await server.stop();
//     });

//     it('ApiCall flow break', async function () {
//         let server = new WebSocketServer(getProto(), {
//             logger: serverLogger
//         });

//         const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

//         server.implementApi('Test', async call => {
//             call.succ({ reply: 'asdgasdgasdgasdg' });
//         });

//         server.flows.preApiCallFlow.push(call => {
//             assert.strictEqual(call.req.name, 'Changed')
//             call.error('You need login');
//             return undefined;
//         });
//         server.flows.postApiCallFlow.push(v => {
//             flowExecResult.postApiCallFlow = true;
//             return v;
//         })

//         await server.start();

//         let client = new WebSocketClient(getProto(), {
//             logger: clientLogger
//         });
//         await client.connect();

//         client.flows.preCallApiFlow.push(v => {
//             if (v.apiName !== 'ObjId') {
//                 v.req.name = 'Changed'
//             }
//             return v;
//         });

//         let ret = await client.callApi('Test', { name: 'xxx' });
//         assert.strictEqual(flowExecResult.postApiCallFlow, undefined);
//         assert.deepStrictEqual(ret, {
//             isSucc: false,
//             err: new TsrpcError('You need login')
//         })

//         await server.stop();
//     });

//     it('ApiCall flow error', async function () {
//         let server = new WebSocketServer(getProto(), {
//             logger: serverLogger
//         });

//         const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

//         server.implementApi('Test', async call => {
//             call.succ({ reply: 'asdgasdgasdgasdg' });
//         });

//         server.flows.preApiCallFlow.push(call => {
//             assert.strictEqual(call.req.name, 'Changed')
//             throw new Error('ASDFASDF')
//         });
//         server.flows.postApiCallFlow.push(v => {
//             flowExecResult.postApiCallFlow = true;
//             return v;
//         })

//         await server.start();

//         let client = new WebSocketClient(getProto(), {
//             logger: clientLogger
//         });
//         await client.connect();

//         client.flows.preCallApiFlow.push(v => {
//             if (v.apiName !== 'ObjId') {
//                 v.req.name = 'Changed'
//             }
//             return v;
//         });

//         let ret = await client.callApi('Test', { name: 'xxx' });
//         assert.strictEqual(flowExecResult.postApiCallFlow, undefined);
//         assert.deepStrictEqual(ret, {
//             isSucc: false,
//             err: new TsrpcError('Internal Server Error', {
//                 type: TsrpcErrorType.ServerError,
//                 innerErr: 'ASDFASDF',
//                 code: 'INTERNAL_ERR'
//             })
//         })

//         await server.stop();
//     });

//     it('server ApiReturn flow', async function () {
//         let server = new WebSocketServer(getProto(), {
//             logger: serverLogger
//         });

//         const flowExecResult: { [K in (keyof BaseServer['flows'])]?: boolean } = {};

//         server.implementApi('Test', async call => {
//             call.succ({ reply: 'xxxxxxxxxxxxxxxxxxxx' });
//         });

//         server.flows.preApiReturnFlow.push(v => {
//             flowExecResult.preApiReturnFlow = true;
//             v.return = {
//                 isSucc: false,
//                 err: new TsrpcError('Ret changed')
//             }
//             return v;
//         });
//         server.flows.postApiReturnFlow.push(v => {
//             flowExecResult.postApiReturnFlow = true;
//             v.call.logger.info('RETTT', v.return);
//             return v;
//         })

//         await server.start();

//         let client = new WebSocketClient(getProto(), {
//             logger: clientLogger
//         });
//         await client.connect();

//         let ret = await client.callApi('Test', { name: 'xxx' });
//         assert.strictEqual(flowExecResult.preApiReturnFlow, true);
//         assert.strictEqual(flowExecResult.postApiReturnFlow, true);
//         assert.deepStrictEqual(ret, {
//             isSucc: false,
//             err: new TsrpcError('Ret changed')
//         })

//         await server.stop();
//     });

//     it('client ApiReturn flow', async function () {
//         let server = new WebSocketServer(getProto(), {
//             logger: serverLogger
//         });

//         const flowExecResult: { [K in (keyof WebSocketClient<any>['flows'])]?: boolean } = {};

//         server.implementApi('Test', async call => {
//             call.succ({ reply: 'xxxxxxxxxxxxxxxxxxxx' });
//         });

//         await server.start();

//         let client = new WebSocketClient(getProto(), {
//             logger: clientLogger
//         });
//         await client.connect();

//         client.flows.preApiReturnFlow.push(v => {
//             flowExecResult.preApiReturnFlow = true;
//             v.return = {
//                 isSucc: false,
//                 err: new TsrpcError('Ret changed')
//             }
//             return v;
//         });
//         client.flows.postApiReturnFlow.push(v => {
//             flowExecResult.postApiReturnFlow = true;
//             client.logger?.info('RETTT', v.return);
//             return v;
//         })

//         let ret = await client.callApi('Test', { name: 'xxx' });
//         assert.strictEqual(flowExecResult.preApiReturnFlow, true);
//         assert.strictEqual(flowExecResult.postApiReturnFlow, true);
//         assert.deepStrictEqual(ret, {
//             isSucc: false,
//             err: new TsrpcError('Ret changed')
//         })

//         await server.stop();
//     });

//     it('client SendBufferFlow prevent', async function () {
//         let server = new WebSocketServer(getProto(), {
//             logger: serverLogger
//         });

//         // const flowExecResult: { [K in (keyof BaseClient<any>['flows'])]?: boolean } = {};

//         server.implementApi('Test', async call => {
//             call.succ({ reply: 'xxxxxxxxxxxxxxxxxxxx' });
//         });

//         await server.start();

//         let client = new WebSocketClient(getProto(), {
//             logger: clientLogger
//         });
//         await client.connect();

//         client.flows.preSendBufferFlow.push(v => {
//             return undefined
//         });

//         let ret: any;
//         client.callApi('Test', { name: 'xxx' }).then(v => { ret = v });
//         await new Promise(rs => { setTimeout(rs, 200) });
//         assert.strictEqual(ret, undefined)

//         await server.stop();
//     });

//     it('onInputBufferError', async function () {
//         let server = new WebSocketServer(getProto(), {
//             logger: serverLogger
//         });
//         await server.start();

//         let client = new WsClient(getProto(), {
//             logger: clientLogger
//         });
//         await client.connect();
//         client.flows.preSendBufferFlow.push(v => {
//             for (let i = 0; i < v.buf.length; ++i) {
//                 v.buf[i] += 1;
//             }
//             return v;
//         });

//         let ret = await client.callApi('Test', { name: 'XXX' });
//         assert.deepStrictEqual(ret, {
//             isSucc: false,
//             err: new TsrpcError('Invalid request buffer, please check the version of service proto.', { type: TsrpcErrorType.NetworkError, code: 'LOST_CONN' })
//         })

//         await server.stop();
//     })

//     it('ObjectId', async function () {
//         let server = new WebSocketServer(getProto(), {
//             logger: serverLogger
//         });
//         server.autoImplementApi(path.resolve(__dirname, '../api'))
//         await server.start();

//         let client = new WsClient(getProto(), {
//             logger: clientLogger
//         });
//         await client.connect();

//         // ObjectId
//         let objId1 = new ObjectId();
//         let ret = await client.callApi('ObjId', {
//             id1: objId1
//         });
//         assert.strictEqual(ret.isSucc, true, ret.err?.message);
//         assert.strictEqual(objId1.toString(), ret.res!.id2.toString());

//         await server.stop();
//     })

//     it('recvMsgFlow', async function () {
//         let server = new WebSocketServer(getProto(), {
//             logger: serverLogger
//         });
//         let serverReceivedMsgs: { name: string, msg: any }[] = [];
//         server.onMsg(/.*/, call => {
//             serverReceivedMsgs.push({ name: call.service.name, msg: call.msg });
//             server.broadcastMsg(call.service.name as any, call.msg);
//         });
//         await server.start();

//         let client = new WsClient(getProto(), {
//             logger: clientLogger
//         });
//         let clientReceivedMsgs: { name: string, msg: any }[] = [];
//         client.flows.preRecvMsgFlow.push(v => {
//             if (v.msgName === 'Chat') {
//                 return undefined;
//             }
//             if (v.msgName === 'Test') {
//                 v.msg.content += 'CCC'
//             }
//             return v;
//         });
//         client.flows.postRecvMsgFlow.push(v => {
//             clientReceivedMsgs.push({ name: v.msgName, msg: v.msg });
//             return v;
//         })
//         await client.connect();

//         client.sendMsg('Chat', {
//             channel: 0,
//             content: 'AAA',
//             time: 0,
//             userName: 'AAA'
//         });
//         client.sendMsg('Test', {
//             content: 'AAA'
//         })
//         await new Promise(rs => { setTimeout(rs, 1000) });

//         assert.deepStrictEqual(serverReceivedMsgs, [{
//             name: 'Chat',
//             msg: {
//                 channel: 0,
//                 content: 'AAA',
//                 time: 0,
//                 userName: 'AAA'
//             }
//         }, {
//             name: 'Test',
//             msg: { content: 'AAA' }
//         }])
//         assert.deepStrictEqual(clientReceivedMsgs, [{
//             name: 'Test',
//             msg: { content: 'AAACCC' }
//         }])

//         await server.stop();
//     })
// })
