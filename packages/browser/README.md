# Browser Client of TSRPC

> TSRPC is a TypeScript RPC framework with runtime type checking and binary serialization.
See more detail at [https://github.com/k8w/tsrpc](https://github.com/k8w/tsrpc).

Official site: https://tsrpc.cn

## Introduction
`HttpClient` is using `XMLHttpRequest`, and `WebSocketClient` is using `WebSocket` of browser. 
Platform adapted to `XMLHttpRequest` and `WebSocket` (like `ReactNative`) can also use this library.

## Usage
```ts
import { HttpClient } from 'tsrpc-browser';
import { serviceProto } from './shared/protocols/serviceProto';

// Create the Client
let client = new HttpClient(serviceProto, {
    server: 'http://127.0.0.1:3000',
    logger: console
});

async function yourFunc() {
    // Call API
    let ret = await client.callApi('Hello', {
        name: 'World'
    });

    // Error: ret.err is TsrpcError
    if (!ret.isSucc) {
        alert('Error: ' + ret.err.message);
        return;
    }

    // Success: ret.res is ResHello
    alert('Success: ' + ret.res.reply);
}
```

## Browser Support
The library is compiled to target `ES2015`, so if you need legacy browser support, you can use Babel to transform the final code to `ES5`. After that it can support all these browser:
- IE8+
- Chrome
- Firefox
- Safari
- etc...

**Caution**
1. To support Internet Explorer, you should import `es6-promise` polyfill by yourself.
2. WebSocket only support IE10+.