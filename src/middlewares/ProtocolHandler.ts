import Protocol from "../../../shared/protocols/Protocol";
import InterfaceValidator from "../../interface-validator/src/validator/InterfaceValidator";
import { ApiHandler, ApiRequest, ApiResponse } from "../core/Api";

function ProtocolHandler<Req, Res>(
    protocol: Protocol<Req, Res>,
    reqValidator: InterfaceValidator,
    handler: ApiHandler<Req, Res>,
    req: ApiRequest<Req>,
    res: ApiResponse<Res>,
    next: () => void
) {
    //写入日志
    req.backApp.config.logAllRequest && console.info(
        '[ApiReq]',
        req.ptl.originalUrl,
        req.ptl.url,
        req.args, 
        req.currentUser ? ('UserId=' + req.currentUser.userId) : 'NOT_LOGIN',
        req.get('Content-Type')
    );

    //用户鉴权
    if (req.backApp.config.parseSsoUser && protocol.needLogin && !req.currentUser) {
        res.error("您还未登录", 'NEED_LOGIN');
        return;
    }

    //校验Request输入参数合法性
    let validateResult = reqValidator.validate((req as any).args);
    if (validateResult.isError) {
        let originalError = validateResult.originalError;
        console.warn('输入参数错误', protocol.url, originalError.fieldName, originalError.message,
            req.currentUser ? "UserId=" + req.currentUser.userId : "[Not login]"
        );
        res.error(originalError.fieldName + ': ' + originalError.message);
        return;
    }

    try {
        let result = handler(req, res, next);
        if (result instanceof Promise) {
            result.catch(e => {
                console.error(protocol.url, req.args, e);
                res.error(e['showInFront'] ? e.message : '服务器内部错误', e['errInfo']);
            })
        }
    }
    catch (e) {
        console.trace(protocol.url, req.args, e);
        res.error(e['showInFront'] ? e.message : '服务器内部错误', e['errInfo']);
    }
}
export default ProtocolHandler;