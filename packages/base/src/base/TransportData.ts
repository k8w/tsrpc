import { Overwrite, uint } from "tsbuffer-schema";
import { TransportDataSchema } from "../proto/TransportDataSchema";
import { TsrpcError } from "../proto/TsrpcError";

export type TransportData =
    Overwrite<Omit<TransportDataSchema & { type: 'req' }, 'serviceId'>, { serviceName: string, body: unknown }>
    | Overwrite<TransportDataSchema & { type: 'res' }, { body: unknown, serviceName: string }>
    | Overwrite<TransportDataSchema & { type: 'err' }, { err: TsrpcError }>
    | Overwrite<Omit<TransportDataSchema & { type: 'msg' }, 'serviceId'>, { serviceName: string, body: unknown }>
    | TransportDataSchema & { type: 'heartbeat' | 'custom' };

/**
 * TransportData -> BoxBuffer_Encoding
 * - serviceName -> serviceId (req res msg)
 * - body -> Uint8Array (req res msg)
 */
export type BoxBuffer = TransportDataSchema & { type: 'res', serviceId: uint }
    | TransportDataSchema & { type: Exclude<TransportDataSchema['type'], 'res'> };

// body -> string
export type BoxTextEncoding = Overwrite<TransportData & { type: 'req' | 'res' | 'msg' }, { body: string }>
    | TransportData & { type: Exclude<TransportData['type'], 'req' | 'res' | 'msg'> };

// body -> object
export type BoxTextDecoding = Overwrite<TransportData & { type: 'req' | 'res' | 'msg' }, { body: object }>
    | TransportData & { type: Exclude<TransportData['type'], 'req' | 'res' | 'msg'> };

export type BoxEncoding = BoxBuffer | BoxTextEncoding;
export type BoxDecoding = BoxBuffer | BoxTextDecoding;