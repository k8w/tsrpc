# CHANGELOG

## [3.1.2-dev.0] - 2021-11-15
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