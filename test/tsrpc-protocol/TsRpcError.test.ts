import * as assert from 'assert';
import { TsrpcError } from 'tsrpc-protocol';

describe('TsrpcError', function () {
    let error = new Error('test');
    let rpcError = new TsrpcError('test', 'info');

    it('TsrpcError is Error', function () {        
        assert(rpcError instanceof Error);
        assert(rpcError instanceof TsrpcError);
    })

    it('Error is not TsrpcError', function () {
        assert(!(error as any instanceof TsrpcError));
    })
})