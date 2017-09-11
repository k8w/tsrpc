import ApiRequest from '../models/ApiRequest';
import ApiResponse from '../models/ApiResponse';
const uuid = require('uuid');

function ApiResponseExtend(req: ApiRequest<any>, res: ApiResponse<any>, next: any) {
    res.set('Content-Type', 'text/plain');
    
    //给ApiResponse扩展succ和error方法
    res.succ = (body: any) => {
        req.rpcServer.conf.logAllRequest && console.debug('[ApiRes]', req.path, req.url, body);
        res.send(res.rpcServer.conf.ptlEncoder(body));
    };

    res.error = (errmsg: string, errinfo?: any) => {
        if (req.backApp.config.showErrId) {
            let errId = uuid().substr(0, 8);
            console.error(
                `[ApiErr] ${req.ptl.originalUrl} ${req.url},`,
                req.currentUser ? `UserId=${req.currentUser.userId},` : 'NotLogin,',
                `ErrId=${errId}`,
                `ErrMsg=${errmsg}`
            );
            errmsg += `[${errId}]`;
        }
        else {
            console.error(
                `[ApiErr] ${req.ptl.originalUrl} ${req.url},`,
                req.currentUser ? `UserId=${req.currentUser.userId},` : 'NotLogin,',
                `ErrMsg=${errmsg}`
            );
        }

        if (res.ptl.noEncrypt) {
            res.json({
                errmsg: errmsg,
                errinfo: errinfo
            });
        }
        else {
            res.send(res.backApp.config.ptlEncoder({
                errmsg: errmsg,
                errinfo: errinfo
            }));
        }
    };

    next();
}
export default ApiResponseExtend;