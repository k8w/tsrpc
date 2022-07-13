# TSRPC 小程序端

> TSRPC 是一个 TypeScript RPC 框架，支持运行时类型检测和TS类型的二进制序列化。
了解更多：[https://github.com/k8w/tsrpc](https://github.com/k8w/tsrpc).

官网网站: https://tsrpc.cn

## 介绍
支持 微信小程序 / QQ小程序 / 字节跳动小程序 / 百度小程序等多个小程序平台。

## 使用
```ts
import { HttpClient } from 'tsrpc-browser';
import { serviceProto } from './shared/protocols/serviceProto';

// 创建 Client
let client = new HttpClient(serviceProto, {
    server: 'http://127.0.0.1:3000',
    logger: console
});

async function yourFunc() {
    // Call API
    let ret = await client.callApi('Hello', {
        name: 'World'
    });

    // 错误处理: ret.err 即为 TsrpcError
    if (!ret.isSucc) {
        alert('Error: ' + ret.err.message);
        return;
    }

    // 成功: ret.res 即为 ResHello
    alert('Success: ' + ret.res.reply);
}
```


