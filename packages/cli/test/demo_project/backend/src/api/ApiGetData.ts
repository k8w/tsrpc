import { ApiCall } from "tsrpc";
import { ReqGetData, ResGetData } from "../shared/protocols/PtlGetData";

export async function ApiGetData(call: ApiCall<ReqGetData, ResGetData>) {
    // TODO
    call.error('API Not Implemented');
}