// @ts-ignore
import { ObjectId } from "mongodb";

export interface ReqExtendData {
    data: {
        buf: Uint8Array;
        date: Date;
        objectId: ObjectId;
    }
}

export interface ResExtendData {
    data: {
        buf: Uint8Array;
        date: Date;
        objectId: ObjectId;
    }
}