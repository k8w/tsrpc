import { TsrpcError } from '@tsrpc/base';
import { HttpRequestOptions, HttpRequestReturn } from '@tsrpc/base-client';
import * as http from 'http';
import https from 'https';

export class HttpUtil {
  static getClientIp(req: http.IncomingMessage) {
    let ipAddress;
    // The request may be forwarded from local web server.
    const forwardedIpsStr = req.headers['x-forwarded-for'] as
      | string
      | undefined;
    if (forwardedIpsStr) {
      // 'x-forwarded-for' header may return multiple IP addresses in
      // the format: "client IP, proxy 1 IP, proxy 2 IP" so take the
      // the first one
      const forwardedIps = forwardedIpsStr.split(',');
      ipAddress = forwardedIps[0];
    }
    if (!ipAddress) {
      // If request was not forwarded
      ipAddress = req.connection.remoteAddress;
    }
    // Remove prefix ::ffff:
    return ipAddress ? ipAddress.replace(/^::ffff:/, '') : '';
  }

  static request(
    options: HttpRequestOptions,
    agent?: http.Agent | https.Agent
  ): HttpRequestReturn {
    const nodeHttp = options.url.startsWith('https://') ? https : http;

    let rs!: (v: Awaited<HttpRequestReturn['promise']>) => void;
    const promise: HttpRequestReturn['promise'] = new Promise((_rs) => {
      rs = _rs;
    });

    const httpReq: http.ClientRequest = nodeHttp.request(
      options.url,
      {
        method: options.method,
        agent: agent,
        timeout: options.timeout,
        headers: options.headers,
      },
      (httpRes) => {
        const data: Buffer[] = [];
        httpRes.on('data', (v: Buffer) => {
          data.push(v);
        });
        httpRes.on('end', () => {
          const buf: Uint8Array = Buffer.concat(data);
          rs({
            isSucc: true,
            body: options.responseType === 'text' ? buf.toString() : buf,
            headers: httpRes.headers as { 'x-@tsrpc/proto-info'?: string },
            statusCode: httpRes.statusCode ?? 200,
          });
        });
      }
    );

    httpReq.on('error', (e) => {
      rs({
        isSucc: false,
        err: new TsrpcError(e.message, {
          type: TsrpcError.Type.NetworkError,
          code: (e as any).code,
        }),
      });
    });

    const buf = options.data;
    httpReq.end(
      typeof buf === 'string'
        ? buf
        : Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
    );

    const abort = (httpReq.destroy ?? httpReq.abort).bind(httpReq);

    return {
      promise: promise,
      abort: abort,
    };
  }
}
