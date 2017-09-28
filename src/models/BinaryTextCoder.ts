export default class BinaryTextCoder{
    static encode(content: object): Buffer {
        return Buffer.from(JSON.stringify(content));
    }

    static decode(buffer: Buffer): any {
        return JSON.parse(buffer.toString());
    }
}