import { Flow } from "../../models/Flow";
import { BaseClientFlows } from "../BaseClientFlows";
import { BaseWsClient } from "./BaseWsClient";

export type BaseWsClientFlows<Conn extends BaseWsClient> = BaseClientFlows<Conn> & {
    preConnectFlow: Flow<Conn>,
};