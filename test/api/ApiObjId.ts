import { ApiCall } from "../../src/server/base/ApiCall"
import { ReqObjId, ResObjId } from "../proto/PtlObjId"

export async function ApiObjId(call: ApiCall<ReqObjId, ResObjId>) {
  call.succ({
    id2: call.req.id1,
    buf: call.req.buf,
    date: call.req.date,
  })
}
