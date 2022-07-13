import { ApiCall } from "tsrpc";
import { ReqLevel1XXX, ResLevel1XXX } from "../../../shared/protocols/user/level1/PtlLevel1XXX";

export async function ApiLevel1XXX(call: ApiCall<ReqLevel1XXX, ResLevel1XXX>) {
    // TODO
    call.error('API Not Implemented');
}