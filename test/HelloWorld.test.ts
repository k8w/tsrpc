import * as assert from 'assert';
import * as path from 'path';
import TsrpcServer from '../src/TsrpcServer';
import PtlHelloWorld from './protocol/PtlHelloWorld';
import ApiHelloWorld from './api/ApiHelloWorld';
import TsrpcClient from '../src/TsrpcClient';
import PtlHelloKing from './protocol/PtlHelloKing';
import { TsrpcError } from 'tsrpc-protocol';

describe('HelloWorld', function () {
    let server: TsrpcServer;
    let client: TsrpcClient;

    before(function () {
        server = new TsrpcServer({
            protocolPath: path.resolve(__dirname, 'protocol'),
            logRequestDetail: true,
            logResponseDetail: true
        });
        server.implementPtl(PtlHelloWorld, ApiHelloWorld);
        server.start();

        client = new TsrpcClient({
            serverUrl: 'http://localhost:3000',
            protocolPath: path.resolve(__dirname, 'protocol')
        })
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
            assert.ok(e instanceof TsrpcError);
            assert.equal(e.info, 'PTL_NOT_FOUND');
        }
    })

    it('500', async function () {
        try {
            await client.callApi(PtlHelloWorld, { name: 'Error' });
            assert(false, 'Should not get res')
        }
        catch (e) {
            assert.ok(e instanceof TsrpcError);
            assert.ok(e.message.startsWith('Internal Server Error'));
            assert.equal(e.info, 'UNHANDLED_API_ERROR');
        }
    })

    it('TsrpcError', async function () {
        try {
            await client.callApi(PtlHelloWorld, { name: 'TsrpcError' });
            assert(false, 'Should not get res')
        }
        catch (e) {
            assert.ok(e instanceof TsrpcError);
            assert.ok(e.message.startsWith('TsrpcError'));
            assert.equal(e.info, 'TsrpcError');
        }
    })

    it('Client Cancel', function (done) {
        let req = client.callApi(PtlHelloWorld, { name: 'Delay' }).then(res => {
            assert.fail('Have canceled, should not be here');
        }).catch(e => {
            assert.fail('Have canceled, should not be here');
        });

        setTimeout(() => {
            req.cancel();
        }, 80)

        setTimeout(() => {
            done();
        }, 200)
    })

    after(function () {
        server.stop()
    })
})