import { BaseClient } from "../base/BaseClient";
import { HttpClientTransport } from "./HttpClientTransport";
import { IHttpFetchProxy } from "./IHttpFetchProxy";

export class BaseHttpClient extends BaseClient {

    constructor(fetch: IHttpFetchProxy) {
        super(new HttpClientTransport(fetch));
    }

}