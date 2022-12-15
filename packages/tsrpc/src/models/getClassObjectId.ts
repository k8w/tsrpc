// TODO require -> import
export function getClassObjectId(): { new(id?: any): any } {
    let classObjId: any;
    try {
        classObjId = require('mongodb').ObjectId;
    }
    catch { }

    if (!classObjId) {
        try {
            classObjId = require('bson').ObjectId;
        }
        catch { }
    }

    if (!classObjId) {
        classObjId = String;
    }

    return classObjId;
}