import ApiRequest from '../../../src/models/ApiRequest';
import { ReqHelloWorld, ResHelloWorld } from '../protocol/PtlHelloWorld';
import ApiResponse from '../../../src/models/ApiResponse';
export default async function ApiHelloWorld(req:ApiRequest<ReqHelloWorld>, res: ApiResponse<ResHelloWorld>) {
    res.succ({
        reply: `Hello, ${req.args.name || 'world'}!`
    })
}