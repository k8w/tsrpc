import { TsRpcPtl, TsRpcReq, TsRpcRes } from "tsrpc-protocol";
import SuperPromise from 'k8w-super-promise';

export default class RpcClient {
    callApi<Req extends TsRpcReq, Res extends TsRpcRes>(ptl: TsRpcPtl<Req, Res>): SuperPromise<Res> {
        //TODO
        return new SuperPromise<Res>(rs => {
            rs({} as Res);
        })
    }

    //hooks
    onRequest?: (ptl: TsRpcPtl<any, any>, req: TsRpcReq) => void;
    onResponse?: (ptl: TsRpcPtl<any, any>, req: TsRpcReq, res: TsRpcRes) => void;
}