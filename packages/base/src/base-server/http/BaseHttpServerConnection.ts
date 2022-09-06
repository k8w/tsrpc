import { ApiReturn } from "../../proto/ApiReturn";

export class BaseHttpServerConnection {
    options!: BaseHttpServerConnectionOptions;
    
    // #region Override text encode options
    protected _encodeJsonStr: ((jsonObj: any, schemaId: string) => string) = (obj, schemaId) => {
        return (this.options.encodeReturnText ?? JSON.stringify)(obj);
    }
    // #endregion
}

export interface BaseHttpServerConnectionOptions {
    encodeReturnText?: (ret: ApiReturn<any>) => string,
}