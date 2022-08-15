import { TSBuffer } from "tsbuffer";
import { TSBufferProto } from "tsbuffer-schema";
import { TransportDataProto } from "../proto/TransportDataProto";
import { TransportData } from "./TransportData";

export class TransportDataUtil {

    private static _tsbuffer?: TSBuffer;
    static get tsbuffer(): TSBuffer {
        if (!this._tsbuffer) {
            this._tsbuffer = new TSBuffer(TransportDataProto as TSBufferProto)
        }

        return this._tsbuffer;
    }

    static validate(data: TransportData) {}

    static encode() { }
    
    static decode(){}

}