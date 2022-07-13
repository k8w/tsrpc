# TSRPC

EN / [中文](https://tsrpc.cn/docs/introduction.html)

A TypeScript RPC framework with runtime type checking and binary serialization.

Official site: https://tsrpc.cn (English version is on the way)

## Features
- Runtime type checking
- Binary serialization
- Pure TypeScript, without any decorater or other language
- HTTP / WebSocket / and more protocols...
- Optional backward-compatibility to JSON
- High performance and reliable, verified by services over 100,000,000 users

## Create Full-stack Project
```
npx create-tsrpc-app@latest
```

## Usage

### Define Protocol (Shared)
```ts
export interface ReqHello {
  name: string;
}

export interface ResHello {
  reply: string;
}
```

### Implement API (Server)
```ts
import { ApiCall } from "tsrpc";

export async function ApiHello(call: ApiCall<ReqHello, ResHello>) {
  call.succ({
    reply: 'Hello, ' + call.req.name
  });
}
```

### Call API (Client)
```ts
let ret = await client.callApi('Hello', {
    name: 'World'
});
```

## Examples

https://github.com/k8w/tsrpc-examples

## Serialization Algorithm
The best TypeScript serialization algorithm ever.
Without any 3rd-party IDL language (like protobuf), it is fully based on TypeScript source file. Define the protocols directly by your code.

This is powered by [TSBuffer](https://github.com/tsbuffer), which is going to be open-source.

TypeScript has the best type system, with some unique advanced features like union type, intersection type, mapped type, etc.

TSBuffer may be the only serialization algorithm that support them all.



## API Reference
See [API Reference](./docs/api/tsrpc.md).