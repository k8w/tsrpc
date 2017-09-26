export default interface ClientConfig {
    /**
     * TSRPC Server Root URL
     * e.g. http://k8w.io/api/
     */
    serverUrl: string;

    /**
     * Root path of protocols, should be an absolute path
     */
    protocolPath: string;

    /**
     * If true, api path will hide from URL (passed via body)
     */
    hideApiPath: boolean;

    /**
     * If true, `ptlEncoder` and `ptlDecoder` should use `ArrayBuffer` instead of `string`, vice versa.
     */
    binaryTransport: boolean;

    //transfer body encoder, would encode to JSON string if this is not assigned
    ptlEncoder: (content: { [key: string]: any }) => ArrayBuffer | string;

    //transfer body decoder, body would be treated as JSON string if this is not assigned
    ptlDecoder: (content: ArrayBuffer | string) => { [key: string]: any };
}

/**
 * default client config
 */
export const DefaultClientConfig: ClientConfig = {
    serverUrl: '',
    protocolPath: '',
    hideApiPath: false,
    binaryTransport: false,
    ptlEncoder: JSON.stringify,
    ptlDecoder: JSON.parse
}