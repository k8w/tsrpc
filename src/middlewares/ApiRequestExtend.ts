import ApiRequest from "../models/ApiRequest";
import ApiResponse from "../models/ApiResponse";

function ApiRequestExtend(req: ApiRequest<any>, res: ApiResponse<any>, next: any) {
    //解析输入参数
    try {
        req.args = typeof (req.body) == 'string' ? JSON.parse(req.body) : req.body;
    }
    catch (e) {
        console.error('InvalidInput', req.url, req.body)
        res.status(400).send('Invalid Request Format');
        return;
    }


    next();
}
export default ApiRequestExtend;