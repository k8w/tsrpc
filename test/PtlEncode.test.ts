import * as assert from 'assert';
import * as path from 'path';
import RpcServer from '../src/RpcServer';
import PtlHelloWorld from './protocol/PtlHelloWorld';
import ApiHelloWorld from './api/ApiHelloWorld';
import RpcClient from '../src/RpcClient';
import PtlHelloKing from './protocol/PtlHelloKing';
import { TsRpcError } from 'tsrpc-protocol';

function encode(content: object): string {
    return global.escape(JSON.stringify(content)).split('').map(v => String.fromCharCode(v.charCodeAt(0) * -1)).reverse().join('')
}

function decode(content: string): any {
    return JSON.parse(global.unescape(content.split('').map(v => String.fromCharCode(v.charCodeAt(0) * -1)).reverse().join('')))
}

describe('PtlEncode', function () {
    let server: RpcServer;
    let client: RpcClient;

    before(function () {
        server = new RpcServer({
            protocolPath: path.resolve(__dirname, 'protocol'),
            logRequestDetail: true,
            logResponseDetail: true,
            ptlEncoder: encode,
            ptlDecoder: decode
        });
        server.implementPtl(PtlHelloWorld, ApiHelloWorld);
        server.start();

        client = new RpcClient({
            serverUrl: 'http://localhost:3000',
            protocolPath: path.resolve(__dirname, 'protocol'),
            ptlEncoder: encode,
            ptlDecoder: decode
        })
    })

    it('encode & decode', function () {
        let src = {a:1,b:2};
        let encoded = encode(src);
        let decoded = decode(encoded);
        assert.notDeepEqual(encoded, JSON.stringify(src));
        assert.notDeepEqual(encoded, String(src));
        assert.deepEqual(decoded, src)
    })

    it('client call', async function () {
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
    })

    it('default param', async function () {
        assert.equal((await client.callApi(PtlHelloWorld)).reply, 'Hello, world!')
    })

    it('404', async function () {
        try {
            await client.callApi(PtlHelloKing);
            assert(false, 'Should not get res')
        }
        catch (e) {
            assert.ok(e instanceof TsRpcError);
            assert.equal(e.info, 'PTL_NOT_FOUND');
        }
    })

    it('500', async function () {
        try {
            await client.callApi(PtlHelloWorld, { name: 'Error' });
            assert(false, 'Should not get res')
        }
        catch (e) {
            assert.ok(e instanceof TsRpcError);
            assert.ok(e.message.startsWith('Internal Server Error'));
            assert.equal(e.info, 'UNHANDLED_API_ERROR');
        }
    })

    it('TsRpcError', async function () {
        try {
            await client.callApi(PtlHelloWorld, { name: 'TsRpcError' });
            assert(false, 'Should not get res')
        }
        catch (e) {
            assert.ok(e instanceof TsRpcError);
            assert.ok(e.message.startsWith('TsRpcError'));
            assert.equal(e.info, 'TsRpcError');
        }
    })

    after(function () {
        server.stop()
    })
})