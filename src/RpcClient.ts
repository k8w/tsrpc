import { TsRpcPtl, TsRpcReq, TsRpcRes, TsRpcError } from "tsrpc-protocol";
import http = require('http');
import SuperPromise from 'k8w-super-promise';
import ClientConfig from './models/ClientConfig';
import { DefaultClientConfig } from './models/ClientConfig';
import { URL } from 'url';

export default class RpcClient {

    readonly config: ClientConfig;
    private _serverUrl: URL;

    /**
     * must set serverUrl and protocolPath
     * @param conf Partial<ClientConfig>
     */
    constructor(config: Partial<ClientConfig> & {
        serverUrl: string,
        protocolPath: string,
    }) {
        this.config = Object.merge({}, DefaultClientConfig, config);
        this._serverUrl = new URL(this.config.serverUrl);
    }

    callApi<Req, Res>(ptl: TsRpcPtl<Req, Res>, req: Req = {} as Req, headers: object = {}): SuperPromise<Res, TsRpcError> {
        this.onRequest && this.onRequest(ptl, req);

        const options: any = {
            hostname: this._serverUrl.hostname,
            port: this._serverUrl.port,
            path: this.config.hideApiPath ?
                this._serverUrl.pathname
                : (this._serverUrl.pathname.replace(/\/+$/, '') + this.getPtlUrl(ptl)),
            headers: headers,
            method: 'POST'
        };

        let output = new SuperPromise<Res, TsRpcError>((rs, rj) => {
            const httpReq = http.request(options, res => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk: any) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        let result = this.config.ptlDecoder(data);
                        this.onResponse && this.onResponse(ptl, req, result as any);
                        result.errmsg == null ? rs(result as Res) : rj(new TsRpcError(result.errmsg, result.errinfo));
                    }
                    catch (e) {
                        console.error('Reponse cannot be decoded.', e);
                        rj(new Error('Reponse cannot be decoded'))
                    }
                })
            });

            httpReq.on('error', (e: Error) => {
                console.error('HTTP request error', e.message);
                rj(e.message);
            });

            httpReq.write(this.config.ptlEncoder(req));
            httpReq.end();
        })

        return output;
    }

    /**
     * Get rpcUrl of protocol
     * Without `/` at the beginning and the end
     * @param ptl 
     * @return like `/a/b/c/DoSomeThing`
     */
    private getPtlUrl(ptl: TsRpcPtl<any, any>): string {
        let filename = ptl.filename.replace(/\.js$/, '.ts');
        if (!filename.startsWith(this.config.protocolPath) || !filename.endsWith('.ts')) {
            throw new Error('Error protocol filename (not in the protocolPath) : ' + filename);
        }
        return filename.substr(this.config.protocolPath.length, filename.length - this.config.protocolPath.length - 3)  // /root/a/b/PtlC.ts -> /a/b/PtlC
            .replace(/\\/g, '/').replace(/Ptl(\w+)$/, '$1'); // /a/b/PtlC -> /a/b/C
    }

    //hooks
    onRequest: ((ptl: TsRpcPtl<any, any>, req: TsRpcReq) => void) | null | undefined;
    onResponse: ((ptl: TsRpcPtl<any, any>, req: TsRpcReq, res: TsRpcRes) => void) | null | undefined;
}









