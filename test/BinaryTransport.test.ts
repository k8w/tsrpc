import * as assert from 'assert';
import * as path from 'path';
import TsrpcServer from '../src/TsrpcServer';
import PtlHelloWorld from './protocol/PtlHelloWorld';
import ApiHelloWorld from './api/ApiHelloWorld';
import TsrpcClient from '../src/TsrpcClient';
import PtlHelloKing from './protocol/PtlHelloKing';
import { TsrpcError } from 'tsrpc-protocol';
import BinaryTextCoder from '../src/models/BinaryTextCoder';

function encode(content: any): Buffer {
    let buf = BinaryTextCoder.encode(content);
    for (let i = 0; i < buf.length; ++i) {
        buf[i] ^= 0xff;
    }
    return buf;
}

function decode(buf: Buffer): any {
    for (let i = 0; i < buf.length; ++i) {
        buf[i] ^= 0xff;
    }
    return JSON.parse(buf.toString());
}

describe('BinaryTransport', function () {
    let server: TsrpcServer;
    let client: TsrpcClient;

    before(function () {
        server = new TsrpcServer({
            protocolPath: path.resolve(__dirname, 'protocol'),
            logRequestDetail: true,
            logResponseDetail: true,
            binaryTransport: true,
            binaryEncoder: encode,
            binaryDecoder: decode
        });
        server.implementPtl(PtlHelloWorld, ApiHelloWorld);
        server.start();

        client = new TsrpcClient({
            serverUrl: 'http://localhost:3000',
            protocolPath: path.resolve(__dirname, 'protocol'),
            binaryTransport: true,
            binaryEncoder: encode,
            binaryDecoder: decode
        })
    })

    it('encode & decode', function () {
        let src = {a:1,b:2};
        let encoded = encode(src);
        assert.notDeepEqual(encoded.toString(), JSON.stringify(src));
        assert.notDeepEqual(encoded.toString(), String(src));

        let decoded = decode(encoded);
        assert.deepEqual(decoded, src)
    })

    it('client call', async function () {
        assert.equal((await client.callApi(PtlHelloWorld, { name: 'Peter' })).reply, 'Hello, Peter!')
    })

    after(function () {
        server.stop()
    })
})