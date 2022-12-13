import { ApiCall } from "tsrpc-base";
import { ReqObjId, ResObjId } from "../proto/PtlObjId";

export async function ApiObjId(call: ApiCall<ReqObjId, ResObjId>) {
    call.succ({
        id2: call.req.id1,
        buf: call.req.buf,
        date: call.req.date
    })
}