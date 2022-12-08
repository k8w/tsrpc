import type { Overwrite, uint } from "tsbuffer-schema";
import { TransportDataSchema } from "../proto/TransportDataSchema";
import { TsrpcError } from "../proto/TsrpcError";

export type TransportData =
    Overwrite<Omit<TransportDataSchema & { type: 'req' }, 'serviceId'>, { serviceName: string, body: unknown, sn: uint }>
    | Overwrite<TransportDataSchema & { type: 'res' }, { body: unknown, serviceName: string, sn: uint }>
    | Overwrite<TransportDataSchema & { type: 'err' }, { err: TsrpcError, sn: uint }>
    | Overwrite<Omit<TransportDataSchema & { type: 'msg' }, 'serviceId'>, { serviceName: string, body: unknown }>
    | TransportDataSchema & { type: 'heartbeat' | 'custom' };

/**
 * TransportData -> BoxBuffer_Encoding
 * - serviceName -> serviceId (req res msg)
 * - body -> Uint8Array (req res msg)
 */
export type BoxBuffer = TransportDataSchema & { type: 'res', serviceId: uint, sn: uint }
    | TransportDataSchema & { type: 'req' | 'err', sn: uint }
    | TransportDataSchema & { type: Exclude<TransportDataSchema['type'], 'req' | 'res' | 'err'> };

// body -> string
export type BoxTextEncoding = Overwrite<TransportData & { type: 'req' | 'res' }, { body: string, sn: uint }>
    | Overwrite<TransportData & { type: 'err' }, { sn: uint }>
    | Overwrite<TransportData & { type: 'msg' }, { body: string }>
    | TransportData & { type: Exclude<TransportData['type'], 'req' | 'res' | 'err' | 'msg'> };

// body -> object
export type BoxTextDecoding = Overwrite<TransportData & { type: 'req' | 'res' }, { body: object, sn: uint }>
    | Overwrite<TransportData & { type: 'err' }, { sn: uint }>
    | Overwrite<TransportData & { type: 'msg' }, { body: object }>
    | TransportData & { type: Exclude<TransportData['type'], 'req' | 'res' | 'err' | 'msg'> };

export type BoxEncoding = BoxBuffer | BoxTextEncoding;
export type BoxDecoding = BoxBuffer | BoxTextDecoding;