import { TsrpcError } from '@tsrpc/base';

export type HttpRequest = (options: HttpRequestOptions) => HttpRequestReturn;

export interface HttpRequestOptions {
  url: string;
  data: string | Uint8Array;
  method: string;
  /** ms */
  timeout?: number;
  headers?: {
    [key: string]: string;
  };
  responseType: 'text' | 'arraybuffer';
}

export type HttpRequestReturn = {
  abort: () => void;
  promise: Promise<
    /** Successful: got response from the server */
    | {
        isSucc: true;
        body: string | Uint8Array;
        headers?: {
          'x-tsrpc-proto-info'?: string;
        };
        statusCode: number;
      }
    /** Failed: Network error, request not sent */
    | {
        isSucc: false;
        err: TsrpcError;
      }
  >;
};
