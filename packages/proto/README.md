# TSRPC Proto

## Introduction
- [TSRPC](https://github.com/k8w/tsrpc) is a TypeScript RPC framework, with runtime type check and binary serialization, both support HTTP and WebSocket.
- `TSRPCProto` is the service definition of it.
- It includes two type service: `ApiService` and `MsgService`.
    - ApiService is like B/S model, send request and wait for reponse.
    - MsgService is like pub/sub model, send and listen specific message.
- Also include some type definition that shared between TSRPC families.

## API
See [API Reference](./docs/api/tsrpc-proto.md).