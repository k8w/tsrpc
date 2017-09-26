export default interface ClientConfig {
    /**
     * TSRPC Server Root URL
     * e.g. http://k8w.io/api/
     */
    serverUrl: string;

    /**
     * If true, api path will hide from URL (passed via body)
     */
    hideApiPath: boolean;

    /**
     * If true, `ptlEncoder` and `ptlDecoder` should use `ArrayBuffer` instead of `string`, vice versa.
     */
    binaryTransport: boolean;

    //transfer body encoder, would encode to JSON string if this is not assigned
    ptlEncoder: (content: object) => ArrayBuffer | string;

    //transfer body decoder, body would be treated as JSON string if this is not assigned
    ptlDecoder: (content: ArrayBuffer | string) => { [key: string]: any };
}

/**
 * default client config
 */
export const defaultClientConfig: ClientConfig = {
    serverUrl: '',
    hideApiPath: false,
    binaryTransport: false,
    ptlEncoder: JSON.stringify,
    ptlDecoder: JSON.parse
}