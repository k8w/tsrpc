import { IncomingMessage, ServerResponse } from 'http';
import { ApiReturn, BaseConnection, BaseServiceType, OpResultVoid, TransportData, TransportOptions } from "tsrpc-base";
import { BaseServerConnection, PrivateBaseServerConnectionOptions } from "tsrpc-base-server";
import { HttpServer } from './HttpServer';

export class HttpServerConnection<ServiceType extends BaseServiceType = any> extends BaseServerConnection<ServiceType> {

    readonly httpReq: IncomingMessage;
    readonly httpRes: ServerResponse;

    constructor(public readonly server: HttpServer, privateOptions: PrivateHttpServerConnectionOptions) {
        super(server, privateOptions);
        this.httpReq = privateOptions.httpReq;
        this.httpRes = privateOptions.httpRes;
    }

    protected async _sendData(data: string | Uint8Array, transportData: TransportData, options?: TransportOptions): Promise<OpResultVoid> {
        return new Promise<OpResultVoid>(rs => {
            if (typeof data === 'string') {
                this.httpRes.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            this.httpRes.end(data, () => {
                rs({ isSucc: true })
            });
        }).catch((e: Error) => {
            this.logger.debug('_sendData error', e);
            return { isSucc: false, errMsg: e.message };
        })
    }

    // #region Override text encode options
    protected _stringifyBodyJson: BaseConnection['_stringifyBodyJson'] = bodyJson => {
        // bodyJson must be ApiReturn<any>
        return this.options.encodeReturnText ? this.options.encodeReturnText(bodyJson as ApiReturn<any>) : JSON.stringify(bodyJson);
    }
    // #endregion
}

export interface PrivateHttpServerConnectionOptions extends PrivateBaseServerConnectionOptions {
    httpReq: IncomingMessage,
    httpRes: ServerResponse,
}