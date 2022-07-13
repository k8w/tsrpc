import { ApiCall } from "tsrpc";
import { ReqDelUser, ResDelUser } from "../../shared/protocols/user/PtlDelUser";

export async function ApiDelUser(call: ApiCall<ReqDelUser, ResDelUser>) {
    // TODO
    call.error('API Not Implemented');
}