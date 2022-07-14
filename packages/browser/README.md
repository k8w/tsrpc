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

## Polyfills

```js
import 'core-js/modules/es.object.to-string.js';
import 'core-js/modules/es.regexp.to-string.js';
import 'core-js/modules/es.number.max-safe-integer.js';
import 'core-js/modules/es.number.constructor.js';
import 'core-js/modules/es.regexp.exec.js';
import 'core-js/modules/es.regexp.test.js';
import 'core-js/modules/es.array.iterator.js';
import 'core-js/modules/es.array-buffer.slice.js';
import 'core-js/modules/es.typed-array.uint8-array.js';
import 'core-js/modules/esnext.typed-array.at.js';
import 'core-js/modules/es.typed-array.copy-within.js';
import 'core-js/modules/es.typed-array.every.js';
import 'core-js/modules/es.typed-array.fill.js';
import 'core-js/modules/es.typed-array.filter.js';
import 'core-js/modules/es.typed-array.find.js';
import 'core-js/modules/es.typed-array.find-index.js';
import 'core-js/modules/es.typed-array.for-each.js';
import 'core-js/modules/es.typed-array.includes.js';
import 'core-js/modules/es.typed-array.index-of.js';
import 'core-js/modules/es.typed-array.iterator.js';
import 'core-js/modules/es.typed-array.join.js';
import 'core-js/modules/es.typed-array.last-index-of.js';
import 'core-js/modules/es.typed-array.map.js';
import 'core-js/modules/es.typed-array.reduce.js';
import 'core-js/modules/es.typed-array.reduce-right.js';
import 'core-js/modules/es.typed-array.reverse.js';
import 'core-js/modules/es.typed-array.set.js';
import 'core-js/modules/es.typed-array.slice.js';
import 'core-js/modules/es.typed-array.some.js';
import 'core-js/modules/es.typed-array.sort.js';
import 'core-js/modules/es.typed-array.subarray.js';
import 'core-js/modules/es.typed-array.to-locale-string.js';
import 'core-js/modules/es.typed-array.to-string.js';
import 'core-js/modules/es.array.from.js';
import 'core-js/modules/es.string.iterator.js';
import 'core-js/modules/es.number.parse-int.js';
import 'core-js/modules/es.array.join.js';
import 'core-js/modules/es.string.match.js';
import 'core-js/modules/es.function.name.js';
import 'core-js/modules/es.json.stringify.js';
import 'core-js/modules/es.promise.js';
import 'core-js/modules/es.regexp.constructor.js';
import 'core-js/modules/es.regexp.sticky.js';
import 'core-js/modules/web.dom-collections.for-each.js';
import 'core-js/modules/es.array.filter.js';
import 'core-js/modules/es.object.keys.js';
import 'core-js/modules/es.array.find-index.js';
import 'core-js/modules/es.array.splice.js';
import 'core-js/modules/es.array.slice.js';
import 'core-js/modules/es.array.find.js';
import 'core-js/modules/es.string.ends-with.js';
import 'core-js/modules/es.array.includes.js';
import 'core-js/modules/es.string.includes.js';
import 'core-js/modules/es.string.starts-with.js';
import 'core-js/modules/es.typed-array.int8-array.js';
import 'core-js/modules/es.typed-array.int16-array.js';
import 'core-js/modules/es.typed-array.int32-array.js';
import 'core-js/modules/es.typed-array.uint16-array.js';
import 'core-js/modules/es.typed-array.uint32-array.js';
import 'core-js/modules/es.typed-array.float32-array.js';
import 'core-js/modules/es.typed-array.float64-array.js';
import 'core-js/modules/es.array.map.js';
import 'core-js/modules/es.object.assign.js';
import 'core-js/modules/es.array.index-of.js';
import 'core-js/modules/web.dom-collections.iterator.js';
import 'core-js/modules/es.array-buffer.constructor.js';
import 'core-js/modules/es.array-buffer.is-view.js';
import 'core-js/modules/web.url.to-json.js';
import 'core-js/modules/es.object.entries.js';
import 'core-js/modules/es.number.is-integer.js';
import 'core-js/modules/es.object.get-prototype-of.js';
import 'core-js/modules/es.parse-int.js';
```