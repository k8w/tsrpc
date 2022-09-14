import 'k8w-extend-native';
import type tsbuffer_schema from 'tsbuffer-schema';

export * from './base/ApiCall';
export * from './base/BaseConnection';
export * from './base/BaseConnectionFlows';
export * from './base/TransportData';
export * from './base/TransportDataUtil';
export * from './models/Chalk';
export * from './models/Counter';
export * from './models/EventEmitter';
export * from './models/Flow';
export * from './models/Logger';
export * from './models/OpResult';
export * from './models/PrefixLogger';
export * from './models/ServiceMapUtil';
export * from './models/TransportOptions';
export * from './models/getCustomObjectIdTypes';
export * from './proto/ApiReturn';
export * from './proto/BaseServiceType';
export * from './proto/ServiceProto';
export * from './proto/TransportDataProto';
export * from './proto/TransportDataSchema';
export * from './proto/TsrpcError';

/** @deprecated Back compatibility for 'tsrpc-proto' */
declare module 'tsrpc-proto' {
    /** @deprecated Import from 'tsbuffer-schema' instead */
    export type int = tsbuffer_schema.int;
    /** @deprecated Import from 'tsbuffer-schema' instead */
    export type uint = tsbuffer_schema.uint;
    /** @deprecated Import from 'tsbuffer-schema' instead */
    export type double = tsbuffer_schema.double;
    /** @deprecated Import from 'tsbuffer-schema' instead */
    export type bigint64 = tsbuffer_schema.bigint64;
    /** @deprecated Import from 'tsbuffer-schema' instead */
    export type biguint64 = tsbuffer_schema.biguint64;
    /** @deprecated Import from 'tsbuffer-schema' instead */
    export type Overwrite<T, U> = tsbuffer_schema.Overwrite<T, U>;
}