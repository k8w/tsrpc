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
     * show error id in errmsg (it is convinient to location a specific error in log)
     */
    showErrId: boolean;

    /**
     * If true, all request will be logged; otherwise only log those with error response
     */
    logAllRequest: boolean;

    /**
     * If use strictNullChecks to validate request, need agree with that in tsconfig
     */
    ptlStrictNullChecks: boolean;

    //transfer body encoder, would encode to JSON if this is not assigned
    ptlEncoder: (content: object) => string;

    //transfer body decoder, body would be treated as JSON if this is not assigned
    ptlDecoder: (content: string) => object;

    /**
     * If true, api path will hide from URL (passed via body)
     */
    hideApiPath: boolean;
}

/**
 * default server config
 */
export const defaultServerConfig: ServerConfig = {
    defaultPort: 3000,
    urlRootPath: '/',
    protocolPath: '',
    autoImplement: false,
    showErrId: true,
    logAllRequest: true,
    ptlStrictNullChecks: true,
    ptlEncoder: JSON.stringify,
    ptlDecoder: JSON.parse,
    hideApiPath: false,
}