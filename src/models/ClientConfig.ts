import BinaryTextCoder from './BinaryTextCoder';
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
}

/**
 * default client config
 */
export const DefaultClientConfig: ClientConfig = {
    serverUrl: '',
    protocolPath: '',
    hideApiPath: false,
    ptlEncoder: JSON.stringify,
    ptlDecoder: JSON.parse,
    binaryTransport: false,
    binaryEncoder: BinaryTextCoder.encode,
    binaryDecoder: BinaryTextCoder.decode
}