import ApiRequest from "../models/ApiRequest";
import ApiResponse from "../models/ApiResponse";
import * as uuid from 'uuid';

async function ApiRequestExtend(req: ApiRequest<any>, res: ApiResponse<any>, next: any) {
    req.reqId = uuid().substr(0, 8);
        
    //去除IPV4 IP的前缀
    if (req.ip.startsWith('::ffff:')) {
        req.ip = req.ip.substr(7);
    }

    //解析输入参数
    try {
        if (req.rpcServer.config.binaryTransport) {
            //body is binary
            req.args = await req.rpcServer.config.binaryDecoder(req.body);
        }
        else {
            //body is plain text
            req.args = await req.rpcServer.config.ptlDecoder(req.body);
        }
    }
    catch (e) {
        req.args = null;
    }

    next();
}
export default ApiRequestExtend;