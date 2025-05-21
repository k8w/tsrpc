// @ts-ignore
import { ObjectId } from "mongodb"

export interface ReqObjId {
  id1: ObjectId
  buf?: Uint8Array
  date?: Date
}

export interface ResObjId {
  id2: ObjectId
  buf?: Uint8Array
  date?: Date
}
