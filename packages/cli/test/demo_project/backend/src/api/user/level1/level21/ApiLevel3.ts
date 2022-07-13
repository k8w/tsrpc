import { ApiCall } from "tsrpc";
import { ReqLevel3, ResLevel3 } from "../../../../shared/protocols/user/level1/level21/PtlLevel3";

export async function ApiLevel3(call: ApiCall<ReqLevel3, ResLevel3>) {
    // TODO
    call.error('API Not Implemented');
}