import { Utf8Coder } from "tsbuffer";

export const nodeUtf8: Utf8Coder = {
    measureLength: str => Buffer.byteLength(str, 'utf-8'),
    write: (str: string, buf: Uint8Array, pos: number) => Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).write(str, pos, 'utf-8'),
    read: (buf: Uint8Array, pos: number, length: number) => Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString('utf-8', pos, pos + length)
}