import { ApiCall } from "tsrpc";
import { ReqDelData, ResDelData } from "../shared/protocols/PtlDelData";

export async function ApiDelData(call: ApiCall<ReqDelData, ResDelData>) {
    call.succ({
        deletedCount: 0
    })
}