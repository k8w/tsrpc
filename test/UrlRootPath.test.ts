import * as assert from 'assert';
import * as path from 'path';
import TsrpcServer from '../src/TsrpcServer';
import PtlHelloWorld from './protocol/PtlHelloWorld';
import ApiHelloWorld from './api/ApiHelloWorld';
import TsrpcClient from '../src/TsrpcClient';
import PtlHelloKing from './protocol/PtlHelloKing';
import { TsrpcError } from 'tsrpc-protocol';

describe('UrlRootPath', function () {
    it('ends with /', async function () {
        let server: TsrpcServer;
        let client: TsrpcClient;

        server = new TsrpcServer({
            protocolPath: path.resolve(__dirname, 'protocol'),
            logRequestDetail: true,
            logResponseDetail: true,
            urlRootPath: '/api/'
        });
        server.implementPtl(PtlHelloWorld, ApiHelloWorld);
        server.start();

        client = new TsrpcClient({
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

        client = new TsrpcClient({
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
        let server: TsrpcServer;
        let client: TsrpcClient;

        server = new TsrpcServer({
            protocolPath: path.resolve(__dirname, 'protocol'),
            logRequestDetail: true,
            logResponseDetail: true,
            urlRootPath: '/api'
        });
        server.implementPtl(PtlHelloWorld, ApiHelloWorld);
        server.start();

        client = new TsrpcClient({
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

        client = new TsrpcClient({
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