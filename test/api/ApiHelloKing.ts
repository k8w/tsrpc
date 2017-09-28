import ApiRequest from '../../src/models/ApiRequest';
import ApiResponse from '../../src/models/ApiResponse';
import { TsRpcError } from 'tsrpc-protocol';
import { ReqHelloKing, ResHelloKing } from '../protocol/PtlHelloKing';

export default async function ApiHelloWorld(req: ApiRequest<ReqHelloKing>, res: ApiResponse<ResHelloKing>) {
    if ((req as any).attachInUse) {
        res.succ({
            reply: (req as any).attachInUse
        })
    }
    else {
        res.succ({
            reply: `Hello, King!`
        })
    }    
}