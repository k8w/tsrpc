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
     * If true, `ptlEncoder` and `ptlDecoder` should use `ArrayBuffer` instead of `string`, vice versa.
     */
    binaryTransport: boolean;

    //transfer body encoder, would encode to JSON string if this is not assigned
    ptlEncoder: (content: object) => ArrayBuffer | string;

    //transfer body decoder, body would be treated as JSON string if this is not assigned
    ptlDecoder: (content: ArrayBuffer | string) => { [key: string]: any };

    /**
     * If true, api path will hide from URL (passed via body)
     */
    hideApiPath: boolean;

    /**
     * If true, errmsg would like "ParamA must be string" instead of "Invalid Request Parameters" when get invalid input
     */
    showParamInvalidReason: boolean;
}

/**
 * default server config
 */
export const defaultServerConfig: ServerConfig = {
    defaultPort: 3000,
    urlRootPath: '/',
    protocolPath: '',
    autoImplement: false,
    showErrorReqId: true,
    logRequestDetail: true,
    logResponseDetail: false,
    ptlStrictNullChecks: true,
    binaryTransport: false,
    ptlEncoder: JSON.stringify,
    ptlDecoder: JSON.parse,
    hideApiPath: false,
    showParamInvalidReason: true
}