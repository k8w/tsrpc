import { CustomTypeSchema, SchemaType } from 'tsbuffer-schema';

export function getCustomObjectIdTypes(classObjectId: { new(id?: any): any }): { [schemaId: string]: CustomTypeSchema } {
    let output: { [schemaId: string]: CustomTypeSchema } = {};

    // string
    if (classObjectId === String) {
        output['?mongodb/ObjectId'] = {
            type: SchemaType.Custom,
            validate: (value: string) => {
                if (typeof value !== 'string') {
                    return { isSucc: false, errMsg: `Expected type to be \`string\`, actually \`${typeof value}\`.` };
                }
                if (!/[0-9a-fA-F]{24}/.test(value)) {
                    return { isSucc: false, errMsg: 'ObjectId must be a string of 24 hex characters' };
                }
                return { isSucc: true };
            },
            encode: (value: string) => {
                return new Uint8Array(Array.from({ length: 12 }, (_, i) => Number.parseInt('0x' + value.substr(i * 2, 2))));
            },
            decode: (buf: Uint8Array) => {
                return Array.from(buf, v => {
                    let str = v.toString(16);
                    if (str.length === 1) {
                        str = '0' + str;
                    }
                    return str;
                }).join('')
            }
        }
    }
    // ObjectId
    else {
        output['?mongodb/ObjectId'] = {
            type: SchemaType.Custom,
            validate: (value: any) => (value instanceof classObjectId) ?
                { isSucc: true } :
                { isSucc: false, errMsg: `Expected to be instance of \`ObjectId\`, actually not.` },
            encode: (value: any) => new Uint8Array(value.id),
            decode: (buf: Uint8Array) => new classObjectId(buf),
            decodeJSON: (json: string) => new classObjectId(json)
        }
    }
    output['?mongodb/ObjectID'] = output['?mongodb/ObjectId'];
    output['?bson/ObjectId'] = output['?mongodb/ObjectId'];
    output['?bson/ObjectID'] = output['?mongodb/ObjectId'];

    return output;
}