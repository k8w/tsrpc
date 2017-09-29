import ApiRequest from '../../src/models/ApiRequest';
import { ReqHelloWorld, ResHelloWorld } from '../protocol/PtlHelloWorld';
import ApiResponse from '../../src/models/ApiResponse';
import { TsRpcError } from 'tsrpc-protocol';
export default async function ApiHelloWorld(req: ApiRequest<ReqHelloWorld>, res: ApiResponse<ResHelloWorld>) {
    if (req.args.name == 'Error') {
        throw new Error('Error');
    }

    if (req.args.name == 'TsRpcError') {
        throw new TsRpcError('TsRpcError', 'TsRpcError');
    }

    if (req.args.name == 'Delay') {
        setTimeout(() => {
            res.succ({
                reply: `Hello, Delay!`
            })
        }, 100);
        return;
    }

    res.succ({
        reply: `Hello, ${req.args.name || 'world'}!`
    })
}