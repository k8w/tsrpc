import ApiRequest from '../models/ApiRequest';
import ApiResponse from '../models/ApiResponse';
const uuid = require('uuid');

function flushOutput(res: ApiResponse<any>) {
    if (res.rpcServer.config.binaryTransport) {
        res.set('Content-Type', 'application/octet-stream')
        res.send(res.rpcServer.config.binaryEncoder(res.rpcOutput));
    }
    else {
        res.set('Content-Type', 'text/plain');
        res.send(res.rpcServer.config.ptlEncoder(res.rpcOutput));
    }
}

function ApiResponseExtend(req: ApiRequest<any>, res: ApiResponse<any>, next: any) {    
    //给ApiResponse扩展succ和error方法
    res.succ = (body: any) => {
        res.rpcOutput = body;
        flushOutput(res);
    };

    res.error = (errmsg: string, errinfo?: any) => {
        res.rpcOutput = {
            errmsg: errmsg,
            errinfo: errinfo
        };

        //leave ErrorId in log, it is useful to location error log
        if (res.rpcServer.config.showErrorReqId) {
            res.rpcOutput.errmsg += ` [${req.reqId}]`;
        }

        flushOutput(res);
    };

    next();
}
export default ApiResponseExtend;