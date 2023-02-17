/* eslint-disable @typescript-eslint/no-var-requires */
// TODO require -> import
export function getClassObjectId(): { new (id?: any): any } {
  let classObjId: any;
  try {
    classObjId = require('mongodb').ObjectId;
  } catch {
    // don't throw error
  }

  if (!classObjId) {
    try {
      classObjId = require('bson').ObjectId;
    } catch {
      // don't throw error
    }
  }

  if (!classObjId) {
    classObjId = String;
  }

  return classObjId;
}
