import { BaseConnection } from "../../base/BaseConnection";
import { TransportData } from "../../base/TransportData";
import { OpResultVoid } from "../../models/OpResult";
import { TransportOptions } from "../../models/TransportOptions";
import { ApiReturn } from "../../proto/ApiReturn";
import { BaseServerConnection, PrivateBaseServerConnectionOptions } from "../BaseServerConnection";
import { BaseHttpServer } from "./BaseHttpServer";
import { HttpReq, HttpRes } from "./BaseHttpServerTransport";

export class BaseHttpServerConnection<Server extends BaseHttpServer = any> extends BaseServerConnection<Server> {

    readonly httpReq: HttpReq;
    readonly httpRes: HttpRes;

    constructor(public readonly server: Server, privateOptions: PrivateBaseHttpServerConnectionOptions) {
        super(server, privateOptions);
        this.httpReq = privateOptions.httpReq;
        this.httpRes = privateOptions.httpRes;
    }

    protected _sendData(data: string | Uint8Array, transportData: TransportData, options?: TransportOptions): Promise<OpResultVoid> {
        return this.httpRes.end(data);
    }

    // #region Override text encode options
    protected _stringifyBodyJson: BaseConnection['_stringifyBodyJson'] = bodyJson => {
        // bodyJson must be ApiReturn<any>
        return this.options.encodeReturnText ? this.options.encodeReturnText(bodyJson as ApiReturn<any>) : JSON.stringify(bodyJson);
    }
    // #endregion
}

export interface PrivateBaseHttpServerConnectionOptions extends PrivateBaseServerConnectionOptions {
    httpReq: HttpReq,
    httpRes: HttpRes,
}

