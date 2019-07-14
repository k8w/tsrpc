import { ServiceProto } from "../proto/ServiceProto";
import { HttpClient } from './HttpClient';
import { HttpSClient } from './HttpsClient';
import { WebSocketClient } from './WsClient';

export class TsrpcClient {

    private _client?: {
        type: 'http',
        client: HttpClient
    } | {
        type: 'https',
        client: HttpSClient
    } | {
        type: 'websocket',
        client: WebSocketClient
    }

    constructor(options: Pick<ClientOptions, 'serverUrl' | 'proto'> & Partial<ClientOptions>) {

    }

    callApi() {

    }

    sendMsg() { }

    listenMsg() { }
    unlistenMsg() { }

    connect() { }

    disconnect() { }

}

export const defaultClientOptions: ClientOptions = {
    serverUrl: '',
    proto: undefined as any,
    // 默认超时30秒
    apiTimeout: 30
}

export interface ClientOptions {
    serverUrl: string;
    proto: ServiceProto;
    apiTimeout: number;

    onStatusChange?: (newStatus: ClientStatus) => void;
    /** 掉线 */
    onLostConnection?: () => void;
}

export type ClientStatus = 'open' | 'connecting' | 'closed';

export type ClientMsgHandler<Msg> = (msg: Msg) => void | Promise<void>;

export interface CallApiOptions {
    /** 超时时间（单位：秒） */
    timeout?: number;
}