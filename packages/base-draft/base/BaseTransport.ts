export abstract class BaseTransport {

    callApi() { }

    implementApi() { }

    sendMsg() { }
    onMsg() { }
    onceMsg() { }
    offMsg() { }

    protected abstract _doSendTransportData(): void;
    protected _recvTransportData() { }

}

export type TransportData<DataType extends string | Uint8Array> = {
    type: 'req',
    sn: number,
    apiName: string,
    data: DataType,
    xxx?: any
} | {
    type: 'ret',
    sn: number,
    data: DataType,
    xxx?: any
} | {
    type: 'heartbeat',
    sn: number
}