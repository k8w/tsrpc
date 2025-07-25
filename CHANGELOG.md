# CHANGELOG

## [3.4.19] - 2025-07-14
### Fixed
- @qianlv: Fixed an issue in `gracefulStop` where `resolve` would never be called if `_pendingApiCallNum` was 0. Resolves #63

## [3.4.18] - 2025-05-28
### Added
- `wsOptions` for `WsServer`

## [3.4.17] - 2024-11-11
### Added
- `server.inputJSON` support `logger` param

## [3.4.16] - 2024-05-05
### Fixed
- Update dependencies `tsbuffer`

## [3.4.14] - 2023-12-28
### Fixed
- Update dependencies

## [3.4.13] - 2023-04-12
### Fixed
- Change log level of `[SendReturnErr]` to `debug` when ws connection is closed

## [3.4.12] - 2023-02-07
### Added
- Add `closeTimeout` for `WsConnection.close`
### Fixed
- Heartbeat timeout should terminate ws connection instantly

## [3.4.11] - 2022-11-26
### Changed
- Update deps

## [3.4.10] - 2022-11-19
### Changed
- Add `httpReq.rawBody` for `HttpConnection`
- `postConnectFlow` now would execute when http connection is established instead of request end

## [3.4.9] - 2022-11-18
### Fixed
- Fixed that `preRecvDataFlow` is not enter if URL is not standard when using JSON mode

## [3.4.8] - 2022-10-19
### Fixed
- Update to `tsrpc-base-client@2.1.10`

## [3.4.7] - 2022-10-15
### Fixed
- Issue that `ws.onClose` is not called when `wsClient.disconnect()` manually at CocosCreator Android platform.
- Issue that the name of Api cannot be the same with it of Msg when using `WsClient` in JSON mode.

## [3.4.6] - 2022-09-28
### Fixed
- Fixed issue that `logLevel` not works

## [3.4.5] - 2022-08-10
### Fixed
- Ignore incoming data after heartbeat timeout

## [3.4.2] - 2022-06-28
### Added
- New options `logConnect` for `WsServer`
- Protect `WebSocketProxy.onClose` executed duplicately.
### Fixed
- Bug: `WebSocketProxy.onClose` is not executed when heartbeat timeout when WIFI is broken

## [3.4.1] - 2022-06-25
### Added
- New client flow: `preRecvMsgFlow` and `postRecvMsgFlow`
- Support `server.listenMsg` by regexp

## [3.4.0] - 2022-06-14
### Added
- `https` options for `HttpServer`
- `wss` options for `WsServer`
- Support using the same name with API and message
### Changed
- Deprecate `serviceName` in `preRecvDataFlow`, use `serviceId` instead
- Optimized log color

## [3.3.3] - 2022-06-07
### Fixed
- Remove `bson` dependency, import `ObjectId` dynamically.

## [3.3.2] - 2022-06-01
### Fixed
- Update dependencies

## [3.3.1] - 2022-05-07
### Fixed
- `HttpConnection.status` not correct when request aborted by client

## [3.3.0] - 2022-04-15
### Added
- Builtin heartbeat support
- New options `logLevel`
### Fixed
- Add response header `Content-Type: application/json; charset=utf-8` for JSON mode under HttpServer, to fix the decoding issue in Chrome dev tools.

## [3.2.5] - 2022-04-12
### Added
- New server options `corsMaxAge` to optimized preflight requests, default value is 3600.
### Fixed
- `NonNullable` cannot be encoded and decoded when as a property in interface

## [3.2.3] - 2022-03-25
### Added
- Print debug-level log when "pre flow" is canceled
### Changed
- Log `[ResErr]` renamed to `[ApiErr]` to consist with client's.
- Log `ApiRes` and `ApiErr` once they are ready to send, instead of after send them.
### Fixed
- When `preSendDataFlow` return undefined, do not send "Internal Server Error".
- Remove some unused code.

## [3.2.2] - 2022-03-22
### Fixed
- `postDisconnectFlow` not executed when `disconnect()` manually


## [3.2.1] - 2022-03-21
### Added
- `preRecvDataFlow` add param `serviceName`
- Support change `dataType` in `postConnectFlow`
### Fixed
- Remark text error

## [3.2.0] - 2022-02-26
### Added
- Support using `keyof`
- Support type alias and `keyof` in `Pick` and `Omit`
- Support `Pick<Intersection>` and `Omit<Intersection>`
- Support `interface` extends Mapped Type, like `Pick` `Omit`
- Support `Pick<XXX, keyof XXX>`
- Support `Pick<XXX, TypeReference>`
- Support `Pick<UnionType>` and `Pick<IntersectionType>`, the same to `Omit`
- Support reference enum value as literal type,like:
    ```ts
    export enum Types {
        Type1,
        Type2
    }
    export interface Obj {
        type: Types.Type1,
        value: string
    }
    ```
### Changed
- `SchemaType` switched to class

## [3.1.9] - 2022-01-12
### Added
- `mongodb-polyfill.d.ts` to fixed mongodb type bug.

## [3.1.6] - 2021-12-29
### Changed
- Return request type error detail when using JSON

## [3.1.5] - 2021-12-23
### Fixed
- Optimize aliyun FC support of `server.inputJSON`

## [3.1.4] - 2021-12-18
### Added
- `WsServer` now support client use `buffer` as transfering format when server set `json: true`
### Fixed
- Type error when disable `skipLibChecks`
- Cannot resolve JSON when `headers` is `application/json; charset=utf-8`
- Cannot resolve serviceName when there is query string in the URL

## [3.1.3] - 2021-12-04
### Added
- `conn.listenMsg`
### Fixed
- Do not `broadcastMsg` when `conns.length` is `0`

## [3.1.2] - 2021-11-17
### Added
- `server.inputJSON` and `server.inputBuffer`
- Add new dataType `json`

## [3.1.1] - 2021-11-09
### Added
- HTTP Text 传输模式下，区分 HTTP 状态码返回，不再统一返回 200

## [3.1.0] - 2021-11-08
### Added
- WebSocket 支持 JSON 格式传输
- JSON 格式传输支持 `ArrayBuffer`、`Date`、`ObjectId`，自动根据协议编解码为 `string`
### Changed
- `jsonEnabled` -> `json`

## [3.0.14] - 2021-10-25
### Added
- 增加 `server.autoImplementApi` 第二个参数 `delay`，用于延迟自动协议注册，加快冷启动速度。

## [3.0.13] - 2021-10-22
### Added
- 增加 `server.callApi` 的支持，以更方便的适配 Serverless 云函数等自定义传输场景。

## [3.0.12] - 2021-10-22
### Fixed
- 修复 `WsServer` 客户端断开连接后，日志显示的 `ActiveConn` 总是比实际多 1 的 BUG

## [3.0.11] - 2021-10-18
### Added
- 增加对 `mongodb/ObjectId` 的支持

## [3.0.10] - 2021-10-13
### Changed
- `BaseConnection` 泛型参数默认为 `any`，便于扩展类型
- `HttpClient` and `WsClient` no longer have default type param

## [3.0.9] - 2021-10-06
### Changed
- `strictNullChecks` 默认改为 `false`

## [3.0.8] - 2021-10-06
### Added
- Optimize log level

## [3.0.7] - 2021-10-06
### Added
- Optimize log color
## [3.0.6] - 2021-09-30
### Added
- "Server started at ..." 前增加 "ERROR：X API registered failed."
### Changed
- `HttpServer.onInputBufferError` 改为 `call.error('InputBufferError')`
- 替换 `colors` 为 `chalk`

## [3.0.5] - 2021-08-14
### Added
- Optimize log for `sendMsg` and `broadcastMsg`
- Return `Internal Server Error` when `SendReturnErr` occured

### Changed
- Remove error `API not return anything`
- handler of `client.listenMsg` changed to `(msg, msgName, client)=>void` 

### Fixed
- NodeJS 12 compability issue (`Uint8Array` and `Buffer` is not treated samely)

## [3.0.3] - 2021-06-27

### Added
- `server.listenMsg` would return `handler` that passed in