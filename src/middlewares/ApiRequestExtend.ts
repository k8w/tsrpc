import ApiRequest from "../models/ApiRequest";
import ApiResponse from "../models/ApiResponse";
import * as uuid from 'uuid';

function ApiRequestExtend(req: ApiRequest<any>, res: ApiResponse<any>, next: any) {
    req.reqId = uuid().substr(0, 8);
        
    //解析输入参数
    try {
        if (req.rpcServer.config.binaryTransport) {
            //body is binary
            req.args = req.rpcServer.config.binaryDecoder(req.body);
        }
        else {
            //body is plain text
            req.args = req.rpcServer.config.ptlDecoder(req.body);
        }
    }
    catch (e) {
        console.error('Invalid Request Body', req.url, req.body)
        res.status(400).send('Invalid Request Body');
        return;
    }

    next();
}
export default ApiRequestExtend;