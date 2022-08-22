import { BaseConnection } from "../base/BaseConnection";
import { BaseConnectionFlows } from "../base/BaseConnectionFlows";
import { Flow } from "../models/Flow";
import { BaseServiceType } from "../proto/BaseServiceType";

export abstract class BaseClient<ServiceType extends BaseServiceType = any> extends BaseConnection<ServiceType> {

    flows: BaseConnectionFlows<this, ServiceType> & {
        // TODO 旧版 Flow 兼容
        /** @deprecated */
        customFlow: Flow<{ aaa: string }>
    } = {} as any;

    // #region @deprecated 旧版 API 兼容
    // TODO
    /** @deprecated */
    listenMsg() { }
    /** @deprecated */
    unlistenMsg() { }
    /** @deprecated */
    unlistenMsgAll() { }
    // ...
    // #endregion

}