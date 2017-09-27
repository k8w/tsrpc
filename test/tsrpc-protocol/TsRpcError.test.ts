import * as assert from 'assert';
import { TsRpcError } from 'tsrpc-protocol';

describe('TsRpcError', function () {
    let error = new Error('test');
    let rpcError = new TsRpcError('test', 'info');

    it('TsRpcError is Error', function () {        
        assert(rpcError instanceof Error);
        assert(rpcError instanceof TsRpcError);
    })

    it('Error is not TsRpcError', function () {
        assert(!(error as any instanceof TsRpcError));
    })
})