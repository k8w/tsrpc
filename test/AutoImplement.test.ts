import * as assert from 'assert';
import * as path from 'path';
import TsrpcServer from '../src/TsrpcServer';
import PtlHelloWorld from './protocol/PtlHelloWorld';
import ApiHelloWorld from './api/ApiHelloWorld';
import TsrpcClient from '../src/TsrpcClient';
import PtlHelloKing from './protocol/PtlHelloKing';
import { TsrpcError } from 'tsrpc-protocol';

describe('AutoImplement', function () {
    let server: TsrpcServer;
    let client: TsrpcClient;

    before(function () {
        server = new TsrpcServer({
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

        client = new TsrpcClient({
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

    it('api not exists', function () {
        assert.throws(function(){
            new TsrpcServer({
                autoImplement: true,
                forceAutoImplementAll: true,
                apiPath: path.resolve(__dirname, 'api_lack'),
                protocolPath: path.resolve(__dirname, 'protocol'),
                logRequestDetail: true,
                logResponseDetail: true                
            });
        })

        assert.doesNotThrow(function () {
            new TsrpcServer({
                autoImplement: true,
                forceAutoImplementAll: false,
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