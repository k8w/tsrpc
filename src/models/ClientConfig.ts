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

    //transfer body encoder, would encode to JSON if this is not assigned
    ptlEncoder: (content: object) => string;

    //transfer body decoder, body would be treated as JSON if this is not assigned
    ptlDecoder: (content: string) => object;
}

/**
 * default client config
 */
export const defaultClientConfig: ClientConfig = {
    serverUrl: '',
    hideApiPath: false,
    ptlEncoder: JSON.stringify,
    ptlDecoder: JSON.parse
}