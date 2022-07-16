import { Overwrite } from "k8w-extend-native";
import { Counter } from "../models/Counter";
import { Flow } from "../models/Flow";
import { ApiService, ServiceMap } from "../models/ServiceMapUtil";
import { ApiReturn } from "../proto/ApiReturn";
import { BaseServiceType } from "../proto/BaseServiceType";
import { TransportDataSchema } from "../proto/TransportDataSchema";
import { TsrpcError } from "../proto/TsrpcError";
import { BaseConnectionFlows } from "./FlowData";

export abstract class BaseConnection<ServiceType extends BaseServiceType = any> {

    declare ServiceType: ServiceType;

    /**
     * {@link Flow} to process `callApi`, `sendMsg`, buffer input/output, etc...
     */
    protected flows: BaseConnectionFlows<this>;
    serviceMap: ServiceMap;

    constructor(private _baseOptions: BaseConnectionOptions) {
        // TODO
        // TEST
        this.serviceMap = null as any;
        this.flows = null as any;
    }

    // #region API
    protected _apiSnCounter = new Counter(1);
    get lastSN() {
        return this._apiSnCounter.last;
    }
    get nextSN() {
        return this._apiSnCounter.getNext(true);
    }

    /**
     * Pending API Requests
     */
    protected _pendingApis = new Map<number, PendingApiItem>;

    /**
     * Send request and wait for the return
     * @param apiName
     * @param req - Request body
     * @param options - Transport options
     * @returns return a `ApiReturn`, all error (network error, business error, code exception...) is unified as `TsrpcError`.
     * The promise is never rejected, so you just need to process all error in one place.
     */
    async callApi<T extends string & keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], options?: TransportOptions): Promise<ApiReturn<ServiceType['api'][T]['res']>> {
        // Add pendingItem
        let sn = this._apiSnCounter.getNext();
        let pendingItem: PendingApiItem = {
            sn: sn,
            abortKey: options?.abortKey,
            abortSignal: options?.abortSignal,
            service: this.serviceMap.apiName2Service[apiName as string]!
        };
        this._pendingApis.set(sn, pendingItem);

        // Call & Flow
        let promise = new Promise<ApiReturn<ServiceType['api'][T]['res']>>(async rs => {
            // Pre Call Flow
            let pre = await this.flows.preCallApiFlow.exec({
                apiName: apiName,
                req: req,
                options: options
            }, this.logger);
            if (!pre || pendingItem.isAborted) {
                this.abort(pendingItem.sn);
                return;
            }

            // Do call (send -> wait -> recv -> return)
            let ret: ApiReturn<ServiceType['api'][T]['res']>;
            // return by pre flow
            if (pre.return) {
                ret = pre.return;
            }
            else {
                // do call means it will send buffer via network
                ret = await this._doCallApi(pre.apiName, pre.req, pre.options, pendingItem);
            }
            if (pendingItem.isAborted) {
                return;
            }

            // Log Original Return
            if (ret.isSucc) {
                this.options.logApi && this.logger?.log(`[ApiRes] #${pendingItem.sn} ${apiName}`, ret.res);
            }
            else {
                this.options.logApi && this.logger?.[ret.err.type === TsrpcError.Type.ApiError ? 'log' : 'error'](`[ApiErr] #${pendingItem.sn} ${apiName}`, ret.err);
            }

            // Pre Return Flow
            let preReturn = await this.flows.preApiReturnFlow.exec({
                ...pre,
                return: ret
            }, this.logger);
            if (!preReturn) {
                this.abort(pendingItem.sn);
                return;
            }

            rs(preReturn.return!);

            // Post Flow
            this.flows.postApiReturnFlow.exec(preReturn, this.logger);
        });

        // Finally clear pendings
        promise.catch().then(() => {
            this._pendingApis.removeOne(v => v.sn === pendingItem.sn);
        })

        return promise;
    }

    implementApi() { }
    abort() { }
    abortByKey() { }
    abortAll() { }
    // #endregion

    // #region Message
    sendMsg() { }
    listenMsg() { }
    unlistenMsg() { }
    unlistenMsgAll() { }
    // #endregion

    // #region Transport
    // 到这一步已经经过类型检测
    // DataFlow 面向二进制 Payload
    // TODO 序列化过程应该是在 Transport 之内的，不同信道（HTTP、WS、Obj）序列化方式不同
    // HTTP JSON：fetch data->body header->header serviceId->URL
    // HTTP BUF: fetch all in body
    // WS JSON: all in json body, serviceId -> service: {'data/AddData'}
    // WS BUF: all in body
    abstract sendTransportData(transportData: TransportData): void;
    abstract recvTransportData(transportData: TransportData): void;
    // #endregion
}

export interface BaseConnectionOptions {
    // Validate
    skipReqValidate?: boolean;
    skipResValidate?: boolean;
    skipMsgValidate?: boolean;

    // Serialization
    jsonEncoder?: any;
    jsonDecoder?: any;
    bufferEncoder?: any;
    bufferDecoder?: any;
}

/**
 * Basic transport unit, for transport-indepentent architecture.
 * The transport-layer should implement its serialization and transportation.
 */
export type TransportData = TransportData_RPC | TransportData_NonRPC;
export type TransportData_RPC = Overwrite<TransportDataSchema & { type: 'req' | 'res' | 'err' | 'msg' }, { data: any }>;
export type TransportData_NonRPC = TransportDataSchema & { type: Exclude<TransportDataSchema['type'], TransportData_RPC['type']> };

export interface PendingApiItem {
    sn: number,
    service: ApiService,
    isAborted?: boolean,
    abortKey?: string,
    abortSignal?: AbortSignal,
    onAbort?: () => void,
    onReturn?: (ret: ApiReturn<any>) => void
}