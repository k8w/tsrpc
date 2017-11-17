import { Log4jsConfig } from './EnableLog4js';
import BinaryTextCoder from './BinaryTextCoder';
export default interface ServerConfig {
    /**
     * default port to start server
     */
    defaultPort: number,

    /**
     * URL root path, default is `/`.
     */
    urlRootPath: string;

    /**
     * protocol definition (PtlXXX.ts) folder path, should be absolute
     */
    protocolPath: string,

    /**
     * If true, automatically implement protocols from `protocolPath` to `apiPath` when server init
     */
    autoImplement: boolean,

    /**
     * If true, server would scan all Ptl in protocolPath and implement them with their ApiHandler.
     * If no matched ApiHandler, it would throw error.
     * @default false
     */
    forceAutoImplementAll: boolean,

    /**
     * [Optional] only need when `autoImplement` is true
     * Api implementation (ApiXXX.ts) folder path, should be absolute
     */
    apiPath?: string,

    /**
     * If true, request id would be append to errmsg (it is convinient to location a specific error in log)
     */
    showErrorReqId: boolean;

    /**
     * If true, every request param would appear in log
     */
    logRequestDetail: boolean;

    /**
     * If true, full response will appear in log (may be large size)
     */
    logResponseDetail: boolean;

    /**
     * If use strictNullChecks to validate request, need agree with that in tsconfig
     */
    ptlStrictNullChecks: boolean;

    /**
     * Plain text body encoder, default is `JSON.stringify`
     */
    ptlEncoder: (content: any) => string | Promise<string>;

    /**
     * Plain text body decoder, default is `JSON.parse`
     */
    ptlDecoder: (content: string) => any | Promise<any>;

    /**
     * If true, transportation would be in binary instead of text.
     * `binaryEncoder` and `binaryDecoder` must be set, and `ptlEncoder` and `ptlDecoder` would not be used.
     */
    binaryTransport: boolean;

    /**
     * To make this work, `binaryTransport` must be true.
     * Default is string `BinaryCoder.json2buffer`.
     */
    binaryEncoder: (content: any) => Buffer | Promise<Buffer>;

    /**
     * To make this work, `binaryTransport` must be true.
     * Default is string `BinaryCoder.buffer2json`.
     */
    binaryDecoder: (content: Buffer) => any | Promise<any>;

    /**
     * If true, api path will hide from URL (passed via body)
     */
    hideApiPath: boolean;

    /**
     * If true, errmsg would like "ParamA must be string" instead of "Invalid Request Parameters" when get invalid input
     */
    showParamInvalidReason: boolean;

    /**
     * Set this to write log files.
     * Default use log4js@1.x, set this to null to disable default log4js.
     * If you want to use default log4js, but don't want any file output, set this to `[]`.
     * Note: log4js will replace native console, if you don't need this, just set `logFiles` to `null`.
     *  `logFile.level` is the minimal level of log to record
     *  `logFile.filename` is prefix of log filename, the actual name is like `${filename}-20170926`
     *  `logFile.path` The folder must be exists
     */
    logFiles: Log4jsConfig[] | null | undefined;
}

/**
 * default server config
 */
export const DefaultServerConfig: ServerConfig = {
    defaultPort: 3000,
    urlRootPath: '/',
    protocolPath: '',
    autoImplement: false,
    forceAutoImplementAll: false,
    showErrorReqId: true,
    logRequestDetail: true,
    logResponseDetail: false,
    ptlStrictNullChecks: true,
    ptlEncoder: JSON.stringify,
    ptlDecoder: JSON.parse,
    binaryTransport: false,
    binaryEncoder: BinaryTextCoder.encode,
    binaryDecoder: BinaryTextCoder.decode,
    hideApiPath: false,
    showParamInvalidReason: true,
    logFiles: [{
        level: 'INFO',
        filename: 'log',
        path: 'logs',
        keepDays: 15
    }]
}