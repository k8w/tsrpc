import { ApiReturn } from "../../proto/ApiReturn";
import { BaseServer, BaseServerOptions } from "../BaseServer";
import { BaseHttpServerConnection } from "./BaseHttpServerConnection";

export class BaseHttpServer<Conn extends BaseHttpServerConnection = any> extends BaseServer<Conn>{

    declare options: BaseHttpServerOptions;

    start(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    protected _stop(): void {
        throw new Error("Method not implemented.");
    }

}

export interface BaseHttpServerOptions extends BaseServerOptions {
    encodeReturnText?: (ret: ApiReturn<any>) => string,
}

export interface PrivateBaseHttpServerOptions {
    transport: any;
}