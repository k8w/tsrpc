import { TransportData } from "../base/BaseConnection";

export class TransportUtil {

    static encodeTransportData(data: TransportData) { }

    static decodeTransportData() { }

}

// TRANSPORT DATA: API_REQ  API_RES  API_ERR MSG ...
// BaseConnection.transport -> TransportData -> send / recv

// BaseConnection send/recv: Data
// BaseConnection.transport send/recv: TransportData

// 应用协议层（Call）：callApi、sendMsg
// 连接层（Connection）：send/recv TransportData
// 传输层（Transport）：send/recv Uint8Array / String / Object

// 应用层 conn.callApi  conn.sendMsg
// 传输协议无关层（抽象连接层） conn._send({ 'req', data: { ... } })  conn._recv({ 'res', data: { ... } })
// 传输层：conn.transport.send(Uint8Array | string | object) conn.transport.recv(Uint8Array | string | object)

// 之前：应用 - client，连接和传输 - conn
// 现在
// 应用 - RpcConnection  conn.callApi  conn.sendMsg
// 中间层 - Serializer：SerializerData -> TransportData
// 传输 - BaseTransport，面向 TransportData （buf | string | object)
    // - conn.transport.send / listen / connect / disconnect / onConnect / onDisconnect


// Serializer：SerializerData
    // 层1：type 结构，data：JS Object (JSON/object)
    // 层2：type 结构，data：Uint8Array (二进制)
    // 统一 API：层1 -> TransportData
    // Transport send/recv 层1
    // Flow 层级
        // call、msg flow
        // encode、decode flow
        // sendData、recvData flow

// Data = string | object | Uint8Array
// 