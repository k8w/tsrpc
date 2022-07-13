import { ApiCall } from "tsrpc";
import { ReqAddUser, ResAddUser } from "../../shared/protocols/user/PtlAddUser";

export async function ApiAddUser(call: ApiCall<ReqAddUser, ResAddUser>) {
    // TODO
    call.error('API Not Implemented');
}