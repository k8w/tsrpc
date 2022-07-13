import { ApiCall } from "tsrpc";
import { ReqAddData, ResAddData } from "../shared/protocols/PtlAddData";

export async function ApiAddData(call: ApiCall<ReqAddData, ResAddData>) {
    // TODO
    call.error('API Not Implemented');
}