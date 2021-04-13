// import { assert } from 'chai';
// import { WsServer } from '../../src/server/ws/WsServer';
// import { WsClient } from '../../src/client/ws/WsClient';
// import { serviceProto, ServiceType } from '../proto/serviceProto';
// import { ApiTest } from '../api/ApiTest';
// import { ApiTest as ApiAbcTest } from '../api/a/b/c/ApiTest';
// import { PrefixLogger } from '../../src/server/models/PrefixLogger';
// import * as path from "path";
// import { MsgChat } from '../proto/MsgChat';
// import { TsrpcError } from 'tsrpc-proto';

// const serverLogger = PrefixLogger.pool.get({
//     prefixs: ['[Server Log]'],
//     logger: console
// });
// const clientLogger = PrefixLogger.pool.get({
//     prefixs: ['[Client Log]'],
//     logger: console
// })

// async function testApi(server: WsServer<ServiceType>, client: WsClient<ServiceType>) {
//     // Succ
//     assert.deepStrictEqual(await client.callApi('Test', {
//         name: 'Req1'
//     }), {
//         reply: 'Test reply: Req1'
//     });
//     assert.deepStrictEqual(await client.callApi('a/b/c/Test', {
//         name: 'Req2'
//     }), {
//         reply: 'a/b/c/Test reply: Req2'
//     });

//     // Inner error
//     for (let v of ['Test', 'a/b/c/Test']) {
//         assert.deepStrictEqual(await client.callApi(v as any, {
//             name: 'InnerError'
//         }).catch(e => ({
//             isSucc: false,
//             message: e.message,
//             info: e.info
//         })), {
//             isSucc: false,
//             message: 'Internal server error',
//             info: {
//                 code: 'INTERNAL_ERR',
//                 isServerError: true
//             }
//         });
//     }

//     // TsrpcError
//     for (let v of ['Test', 'a/b/c/Test']) {
//         assert.deepStrictEqual(await client.callApi(v as any, {
//             name: 'TsrpcError'
//         }).catch(e => ({
//             isSucc: false,
//             message: e.message,
//             info: e.info
//         })), {
//             isSucc: false,
//             message: v + ' TsrpcError',
//             info: 'ErrInfo ' + v
//         });
//     }
// }

// describe('WsClient', function () {
//     it('implement API manually', async function () {
//         let server = new WsServer({
//             proto: serviceProto,
//             logger: serverLogger
//         });
//         await server.start();

//         server.implementApi('Test', ApiTest);
//         server.implementApi('a/b/c/Test', ApiAbcTest);

//         let client = new WsClient({
//             proto: serviceProto,
//             logger: clientLogger
//         });
//         await client.connect();

//         await testApi(server, client);

//         await server.stop();
//     })

//     it('autoImplementApi', async function () {
//         let server = new WsServer({
//             proto: serviceProto,
//             logger: serverLogger
//         });
//         await server.start();

//         server.autoImplementApi(path.resolve(__dirname, 'api'))

//         let client = new WsClient({
//             proto: serviceProto,
//             logger: clientLogger
//         });
//         await client.connect();

//         await testApi(server, client);

//         await server.stop();
//     });

//     it('sendMsg', async function () {
//         let server = new WsServer({
//             port: 3001,
//             proto: serviceProto,
//             logger: serverLogger
//         });
//         await server.start();

//         let client = new WsClient({
//             server: 'http://127.0.0.1:3001',
//             proto: serviceProto,
//             logger: clientLogger
//         });
//         await client.connect();

//         return new Promise(rs => {
//             let msg: MsgChat = {
//                 channel: 123,
//                 userName: 'fff',
//                 content: '666',
//                 time: Date.now()
//             };

//             server.listenMsg('Chat', async v => {
//                 assert.deepStrictEqual(v.msg, msg);
//                 await server.stop();
//                 rs();
//             });

//             client.sendMsg('Chat', msg);
//         })
//     })

//     it('cancel', async function () {
//         let server = new WsServer({
//             proto: serviceProto,
//             logger: serverLogger
//         });
//         await server.start();

//         server.autoImplementApi(path.resolve(__dirname, 'api'))

//         let client = new WsClient({
//             proto: serviceProto,
//             logger: clientLogger
//         });
//         await client.connect();

//         let result: any | undefined;
//         let promise = client.callApi('Test', { name: 'aaaaaaaa' });
//         setTimeout(() => {
//             promise.cancel();
//         }, 0);
//         promise.then(v => {
//             result = v;
//             return v;
//         });

//         await new Promise(rs => {
//             setTimeout(() => {
//                 assert.strictEqual(result, undefined);
//                 rs();
//             }, 100)
//         })

//         await server.stop();
//     });

//     it('error', async function () {
//         let server = new WsServer({
//             proto: serviceProto,
//             logger: serverLogger
//         });
//         await server.start();

//         let client1 = new WsClient({
//             server: 'http://localhost:80',
//             proto: serviceProto,
//             logger: clientLogger
//         })

//         let err1: TsrpcError | undefined;
//         await client1.connect().catch(e => {
//             err1 = e
//         })
//         assert.deepStrictEqual(err1!.info, { code: 'ECONNREFUSED', isNetworkError: true });
//         assert(err1!.message.indexOf('ECONNREFUSED') > -1)

//         await server.stop();
//     });

//     it('server timeout', async function () {
//         let server = new WsServer({
//             proto: serviceProto,
//             logger: serverLogger,
//             timeout: 100
//         });
//         server.implementApi('Test', call => {
//             return new Promise(rs => {
//                 setTimeout(() => {
//                     call.req && call.succ({
//                         reply: 'Hi, ' + call.req.name
//                     });
//                     rs();
//                 }, 200)
//             })
//         })
//         await server.start();

//         let client = new WsClient({
//             proto: serviceProto,
//             logger: clientLogger
//         });
//         await client.connect();

//         let result = await client.callApi('Test', { name: 'Jack' }).catch(e => e);
//         assert.deepStrictEqual(result, {
//             message: 'Server Timeout', info: {
//                 code: 'SERVER_TIMEOUT',
//                 isServerError: true
//             }
//         });

//         await server.stop();
//     });

//     it('client timeout', async function () {
//         let server = new WsServer({
//             proto: serviceProto,
//             logger: serverLogger
//         });
//         server.implementApi('Test', call => {
//             return new Promise(rs => {
//                 setTimeout(() => {
//                     call.succ({
//                         reply: 'Hi, ' + call.req.name
//                     });
//                     rs();
//                 }, 2000)
//             })
//         })
//         await server.start();

//         let client = new WsClient({
//             timeout: 100,
//             proto: serviceProto,
//             logger: clientLogger
//         });
//         await client.connect();

//         let result = await client.callApi('Test', { name: 'Jack' }).catch(e => e);
//         assert.strictEqual(result.message, 'Request Timeout');
//         assert.deepStrictEqual(result.info, {
//             code: 'TIMEOUT',
//             isNetworkError: true
//         });

//         await server.stop();
//     });

//     it('enablePool: false', async function () {
//         let server = new WsServer({
//             proto: serviceProto,
//             logger: serverLogger
//         });
//         await server.start();

//         server.implementApi('Test', call => {
//             let callOptions = call.options;
//             let logger = call.logger;
//             let loggerOptions = call.logger.options;
//             call.succ({ reply: 'ok' });
//             setTimeout(() => {
//                 assert.strictEqual(call['_options'], callOptions);
//                 assert.strictEqual(call.logger, logger);
//                 assert.strictEqual(call.logger['_options'], loggerOptions);
//             }, 200)
//         });

//         let client = new WsClient({
//             proto: serviceProto,
//             logger: clientLogger
//         });
//         await client.connect();

//         await client.callApi('Test', { name: 'xx' });
//         await new Promise(rs => setTimeout(rs, 300));

//         await server.stop();
//     })

//     it('enablePool: true', async function () {
//         let server = new WsServer({
//             proto: serviceProto,
//             logger: serverLogger,
//             enablePool: true
//         });
//         await server.start();

//         server.implementApi('Test', call => {
//             let logger = call.logger;
//             call.succ({ reply: 'ok' });
//             setTimeout(() => {
//                 assert.strictEqual(call['_options'], undefined);
//                 assert.strictEqual(logger['_options'], undefined);
//             }, 200)
//         });

//         let client = new WsClient({
//             proto: serviceProto,
//             logger: clientLogger
//         });
//         await client.connect();

//         await client.callApi('Test', { name: 'xx' });
//         await new Promise(rs => setTimeout(rs, 300));

//         await server.stop();
//     })
// })