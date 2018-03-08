TSRPC
===

Full-stack TypeScript RPC framework.<br/>
If you have any question, feel free to submit a issue.

## Features
1. Full-stack: Support both NodeJS and browser
1. Isomorphism: All TypeScript, share code between frontend and backend
1. Safe & efficient: Strong and automatic type checks
1. Fullstack, support both node and browser

## Usage (NodeJS)


```
npm install tsrpc
```

### Server

#### Define a protocol

```typescript
// project/protocol/PtlHelloWorld.ts
import { TsrpcPtl } from "tsrpc-protocol";

const PtlHelloWorld = new TsrpcPtl<ReqHelloWorld, ResHelloWorld>(__filename);
export default PtlHelloWorld;

export interface ReqHelloWorld {
    name?: string;
}

export interface ResHelloWorld {
    reply: string;
}
```

#### Implement a protocol (API handler)

```typescript
// project/api/ApiHelloWorld.ts
import {ApiRequest,ApiResponse} from 'tsrpc';
import { ReqHelloWorld, ResHelloWorld } from '../protocol/PtlHelloWorld';
import { TsrpcError } from 'tsrpc-protocol';

export default async function ApiHelloWorld(req: ApiRequest<ReqHelloWorld>, res: ApiResponse<ResHelloWorld>) {
    res.succ({
        reply: `Hello, ${req.args.name || 'world'}!`
    })
}
```

#### Start server

```typescript
// project/index.ts
import {TsrpcServer} from 'tsrpc';
import * as path from 'path';
import PtlHelloWorld from './protocol/PtlHelloWorld';
import ApiHelloWorld from './protocol/ApiHelloWorld';

let server = new TsrpcServer({
    protocolPath: path.resolve(__dirname, 'protocol')
});
// register protocol and API
server.implementPtl(PtlHelloWorld, ApiHelloWorld);
server.start();
```

#### Auto register protocol and API

```typescript
import {TsrpcServer} from 'tsrpc';
import * as path from 'path';

let server = new TsrpcServer({
    autoImplement: true,
    apiPath: path.resolve(__dirname, 'api'),
    protocolPath: path.resolve(__dirname, 'protocol')        
});
server.start();
```

### Client

```typescript
import {TsrpcClient} from 'tsrpc';
import PtlHelloWorld from './protocol/PtlHelloWorld';

let client = new TsrpcClient({
    serverUrl: 'http://localhost:3000',
    protocolPath: path.resolve(__dirname, 'protocol')
})

client.callApi(PtlHelloWorld, { name: 'k8w' }).then(res=>{
    console.log(res.reply); //Hello, k8w!
})
```

We suggest you use async/await like this:

```typescript
async function main(){
    let res = await client.callApi(PtlHelloWorld, { name: 'k8w' });
    console.log(res.reply); //Hello, k8w!
}
```

## Usage (Browser)

```
npm install tsrpc-browser
```

```typescript
import {TsrpcClient} from 'tsrpc-browser';
import PtlHelloWorld from './protocol/PtlHelloWorld';

let client = new TsrpcClient({
    serverUrl: 'http://localhost:3000'
    // Don't need protocolPath for Browser usage
})

// Rest is the same with NodeJS
client.callApi(PtlHelloWorld, { name: 'k8w' }).then(res=>{
    console.log(res.reply); //Hello, k8w!
})
```