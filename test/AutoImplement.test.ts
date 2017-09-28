import * as assert from 'assert';
import * as path from 'path';
import RpcServer from '../src/RpcServer';
import PtlHelloWorld from './protocol/PtlHelloWorld';
import ApiHelloWorld from './api/ApiHelloWorld';
import RpcClient from '../src/RpcClient';
import PtlHelloKing from './protocol/PtlHelloKing';
import { TsRpcError } from 'tsrpc-protocol';

describe('AutoImplement', function () {
    let server: RpcServer;
    let client: RpcClient;

    before(function () {
        server = new RpcServer({
            autoImplement: true,
            apiPath: path.resolve(__dirname, 'api'),
            protocolPath: path.resolve(__dirname, 'protocol'),
            logRequestDetail: true,
            logResponseDetail: true            
        });

        //use
        server.use((req, res, next) => {
            (req as any).attachInUse = 'Attached in use';
            next();
        })

        server.start();

        client = new RpcClient({
            serverUrl: 'http://localhost:3000',
            protocolPath: path.resolve(__dirname, 'protocol')
        })
    })

    it('client call', async function () {
        assert.equal((await client.callApi(PtlHelloWorld, { name: 'Peter' })).reply, 'Hello, Peter!')
    })

    it('use', async function () {
        assert.equal((await client.callApi(PtlHelloKing)).reply, 'Attached in use')
    })

    it('default param', async function () {
        assert.equal((await client.callApi(PtlHelloWorld)).reply, 'Hello, world!')
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

    it('api not exists', function () {
        assert.throws(function(){
            new RpcServer({
                autoImplement: true,
                apiPath: path.resolve(__dirname, 'api_lack'),
                protocolPath: path.resolve(__dirname, 'protocol'),
                logRequestDetail: true,
                logResponseDetail: true                
            });
        })
    })

    after(function () {
        server.stop()
    })
})