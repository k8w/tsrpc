import http from "http";
import https from "https";
import { IHttpProxy } from "tsrpc-base-client";
import { TsrpcError } from "tsrpc-proto";

/** @internal */
export class HttpProxy implements IHttpProxy {

    /** NodeJS HTTP Agent */
    agent?: http.Agent | https.Agent;

    fetch(options: Parameters<IHttpProxy['fetch']>[0]): ReturnType<IHttpProxy['fetch']> {
        let nodeHttp = options.url.startsWith('https://') ? https : http;

        let rs!: (v: { isSucc: true, res: string | Uint8Array } | { isSucc: false, err: TsrpcError }) => void;
        let promise: ReturnType<IHttpProxy['fetch']>['promise'] = new Promise(_rs => {
            rs = _rs;
        })

        let httpReq: http.ClientRequest;
        httpReq = nodeHttp.request(options.url, {
            method: options.method,
            agent: this.agent,
            timeout: options.timeout,
            headers: options.headers,
        }, httpRes => {
            let data: Buffer[] = [];
            httpRes.on('data', (v: Buffer) => {
                data.push(v)
            });
            httpRes.on('end', () => {
                let buf: Uint8Array = Buffer.concat(data);
                if (options.responseType === 'text') {
                    rs({
                        isSucc: true,
                        res: buf.toString()
                    })
                }
                else {
                    rs({
                        isSucc: true,
                        res: buf
                    })
                }
            })
        });

        httpReq.on('error', e => {
            rs({
                isSucc: false,
                err: new TsrpcError(e.message, {
                    type: TsrpcError.Type.NetworkError,
                    code: (e as any).code
                })
            });
        });
        httpReq.end(options.data);

        let abort = httpReq.abort.bind(httpReq);

        return {
            promise: promise,
            abort: abort
        }
    }

}