import assert from "assert";
import { ObjectId } from 'mongodb';
import { ApiCall } from "tsrpc";
import { ReqExtendData, ResExtendData } from "../../proto/PtlExtendData";

export async function ApiExtendData(call: ApiCall<ReqExtendData, ResExtendData>) {
    assert.ok(call.req.data.buf instanceof Uint8Array);
    assert.ok(call.req.data.date instanceof Date);
    assert.ok(call.req.data.objectId instanceof ObjectId)
    call.succ({
        data: call.req.data
    })
}