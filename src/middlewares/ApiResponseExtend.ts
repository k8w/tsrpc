import ApiRequest from '../models/ApiRequest';
import ApiResponse from '../models/ApiResponse';
const uuid = require('uuid');

function ApiResponseExtend(req: ApiRequest<any>, res: ApiResponse<any>, next: any) {
    res.set('Content-Type', 'text/plain');
    
    //给ApiResponse扩展succ和error方法
    res.succ = (body: any) => {
        res.rpcOutput = body;
        res.send(res.rpcServer.config.ptlEncoder(body));
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

        res.send(res.rpcServer.config.ptlEncoder(res.rpcOutput));
    };

    next();
}
export default ApiResponseExtend;