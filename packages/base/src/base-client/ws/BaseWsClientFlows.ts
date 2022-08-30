import { Flow } from "../../models/Flow";
import { BaseServiceType } from "../../proto/BaseServiceType";
import { BaseClientFlows } from "../BaseClientFlows";
import { BaseWsClient } from "./BaseWsClient";

export type BaseWsClientFlows<Conn extends BaseWsClient, ServiceType extends BaseServiceType> = BaseClientFlows<Conn, ServiceType> & {
    preConnectFlow: Flow<Conn>,
};