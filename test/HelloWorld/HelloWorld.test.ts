import * as assert from 'assert';
import * as path from 'path';
import RpcServer from '../../src/RpcServer';
import PtlHelloWorld from './protocol/PtlHelloWorld';
import ApiHelloWorld from './api/ApiHelloWorld';
import RpcClient from '../../src/RpcClient';

describe('RpcServer', function () {
    let server: RpcServer;
    let client: RpcClient;

    before(function () {
        server = new RpcServer({
            protocolPath: path.resolve(__dirname, 'protocol')
        });
        server.implementPtl(PtlHelloWorld, ApiHelloWorld);
        server.start();

        client = new RpcClient({
            serverUrl: 'http://localhost:3000',
            protocolPath: path.resolve(__dirname, 'protocol')
        })
    })

    it('client call', async function () {
        assert.equal((await client.callApi(PtlHelloWorld, { name: 'Peter' })).reply, 'Hello, Peter!')
    })

    it('default param', async function () {
        assert.equal((await client.callApi(PtlHelloWorld)).reply, 'Hello, world!')
    })
})