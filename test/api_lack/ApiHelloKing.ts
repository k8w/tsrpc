import ApiRequest from '../../src/models/ApiRequest';
import ApiResponse from '../../src/models/ApiResponse';
import { TsrpcError } from 'tsrpc-protocol';
import { ReqHelloKing, ResHelloKing } from '../protocol/PtlHelloKing';

export default async function ApiHelloWorld(req: ApiRequest<ReqHelloKing>, res: ApiResponse<ResHelloKing>) {
    res.succ({
        reply: `Hello, King!`
    })
}