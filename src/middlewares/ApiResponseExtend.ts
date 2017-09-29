import ApiRequest from '../models/ApiRequest';
import ApiResponse from '../models/ApiResponse';
const uuid = require('uuid');

async function flushOutput(res: ApiResponse<any>) {
    if (res.rpcServer.config.binaryTransport) {
        res.set('Content-Type', 'application/octet-stream')
        res.send(await res.rpcServer.config.binaryEncoder(res.rpcOutput));
    }
    else {
        res.set('Content-Type', 'text/plain');
        res.send(await res.rpcServer.config.ptlEncoder(res.rpcOutput));
    }
}

function ApiResponseExtend(req: ApiRequest<any>, res: ApiResponse<any>, next: any) {    
    //给ApiResponse扩展succ和error方法
    res.succ = async (body: any) => {
        res.rpcOutput = body;
        await flushOutput(res);
    };

    res.error = async (errmsg: string, errinfo?: any) => {
        res.rpcOutput = {
            errmsg: errmsg,
            errinfo: errinfo
        };

        //leave ErrorId in log, it is useful to location error log
        if (res.rpcServer.config.showErrorReqId) {
            res.rpcOutput.errmsg += ` [${req.reqId}]`;
        }

        await flushOutput(res);
    };

    next();
}
export default ApiResponseExtend;