import * as assert from 'assert';
import * as path from 'path';
import RpcServer from '../src/RpcServer';
import PtlHelloWorld from './protocol/PtlHelloWorld';
import ApiHelloWorld from './api/ApiHelloWorld';
import RpcClient from '../src/RpcClient';
import PtlHelloKing from './protocol/PtlHelloKing';
import { TsRpcError } from 'tsrpc-protocol';

describe('UrlRootPath', function () {
    it('ends with /', async function () {
        let server: RpcServer;
        let client: RpcClient;

        server = new RpcServer({
            protocolPath: path.resolve(__dirname, 'protocol'),
            logRequestDetail: true,
            logResponseDetail: true,
            urlRootPath: '/api/'
        });
        server.implementPtl(PtlHelloWorld, ApiHelloWorld);
        server.start();

        client = new RpcClient({
            serverUrl: 'http://localhost:3000/api/',
            protocolPath: path.resolve(__dirname, 'protocol')
        })

        let reqStr = '', resStr = '';
        client.onRequest = () => {
            reqStr = 'reqStr';
        }
        client.onResponse = () => {
            resStr = 'resStr'
        }
        assert.equal((await client.callApi(PtlHelloWorld, { name: 'Peter' })).reply, 'Hello, Peter!')
        assert.equal(reqStr, 'reqStr')
        assert.equal(resStr, 'resStr')

        client.onRequest = client.onResponse = undefined;

        client = new RpcClient({
            serverUrl: 'http://localhost:3000/api',
            protocolPath: path.resolve(__dirname, 'protocol')
        })

        reqStr = '', resStr = '';
        client.onRequest = () => {
            reqStr = 'reqStr';
        }
        client.onResponse = () => {
            resStr = 'resStr'
        }
        assert.equal((await client.callApi(PtlHelloWorld, { name: 'Peter' })).reply, 'Hello, Peter!')
        assert.equal(reqStr, 'reqStr')
        assert.equal(resStr, 'resStr')

        client.onRequest = client.onResponse = undefined;
        server.stop();
    })

    it('not ends with /', async function () {
        let server: RpcServer;
        let client: RpcClient;

        server = new RpcServer({
            protocolPath: path.resolve(__dirname, 'protocol'),
            logRequestDetail: true,
            logResponseDetail: true,
            urlRootPath: '/api'
        });
        server.implementPtl(PtlHelloWorld, ApiHelloWorld);
        server.start();

        client = new RpcClient({
            serverUrl: 'http://localhost:3000/api',
            protocolPath: path.resolve(__dirname, 'protocol')
        })

        let reqStr = '', resStr = '';
        client.onRequest = () => {
            reqStr = 'reqStr';
        }
        client.onResponse = () => {
            resStr = 'resStr'
        }
        assert.equal((await client.callApi(PtlHelloWorld, { name: 'Peter' })).reply, 'Hello, Peter!')
        assert.equal(reqStr, 'reqStr')
        assert.equal(resStr, 'resStr')

        client.onRequest = client.onResponse = undefined;

        client = new RpcClient({
            serverUrl: 'http://localhost:3000/api/',
            protocolPath: path.resolve(__dirname, 'protocol')
        })

        reqStr = '', resStr = '';
        client.onRequest = () => {
            reqStr = 'reqStr';
        }
        client.onResponse = () => {
            resStr = 'resStr'
        }
        assert.equal((await client.callApi(PtlHelloWorld, { name: 'Peter' })).reply, 'Hello, Peter!')
        assert.equal(reqStr, 'reqStr')
        assert.equal(resStr, 'resStr')

        client.onRequest = client.onResponse = undefined;
        server.stop();
    })
})