import * as assert from 'assert';
import * as path from 'path';
import TsRpcServer from '../src/TsRpcServer';
import PtlHelloWorld from './protocol/PtlHelloWorld';
import ApiHelloWorld from './api/ApiHelloWorld';
import TsRpcClient from '../src/TsRpcClient';
import PtlHelloKing from './protocol/PtlHelloKing';
import { TsRpcError } from 'tsrpc-protocol';

describe('UrlRootPath', function () {
    it('ends with /', async function () {
        let server: TsRpcServer;
        let client: TsRpcClient;

        server = new TsRpcServer({
            protocolPath: path.resolve(__dirname, 'protocol'),
            logRequestDetail: true,
            logResponseDetail: true,
            urlRootPath: '/api/'
        });
        server.implementPtl(PtlHelloWorld, ApiHelloWorld);
        server.start();

        client = new TsRpcClient({
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

        client = new TsRpcClient({
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
        let server: TsRpcServer;
        let client: TsRpcClient;

        server = new TsRpcServer({
            protocolPath: path.resolve(__dirname, 'protocol'),
            logRequestDetail: true,
            logResponseDetail: true,
            urlRootPath: '/api'
        });
        server.implementPtl(PtlHelloWorld, ApiHelloWorld);
        server.start();

        client = new TsRpcClient({
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

        client = new TsRpcClient({
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