import * as assert from 'assert';
import * as path from 'path';
import RpcServer from '../../src/RpcServer';
import PtlHelloWorld from './protocol/PtlHelloWorld';
import ApiHelloWorld from './api/ApiHelloWorld';

describe('RpcServer', function () {
    let server: RpcServer;

    before(function () {
        server = new RpcServer({
            protocolPath: path.resolve(__dirname, 'protocol')
        });
        server.implementPtl(PtlHelloWorld, ApiHelloWorld);
        server.start();
    })

    it('default', function () {
        
    })
})