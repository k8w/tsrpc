# CHANGELOG

## [2.1.2] - 2022-06-25
### Added
- Add `preRecvMsgFlow` and `postRecvMsgFlow`

## [2.1.1] - 2022-06-19
### Fixed
- Return error when `WsClient` get `onError` event when connecting.

## [2.1.0] - 2022-06-14
### Changed
- Add url search `?type=msg` when call `HttpClient.sendMsg()` in JSON mode
- Changed type of `WebSocketProxy.onError`
### Fixed
- Remove error log when call `HttpClient.sendMsg()`

## [2.0.7] - 2022-06-01
### Fixed
- Update deps

## [2.0.5] - 2022-04-15
### Added
- Builtin heartbeat support
- New options `logApi` and `logMsg`
- New options `logLevel`

## [2.0.4] - 2022-04-12
### Changed
- Update `tsbuffer` to version `2.2.2`

## [2.0.2] - 2022-03-25
### Fixed
- Compatibility with Cocos Creator on Android, when using `disconnect` without parameters.

## [2.0.1] - 2022-3-21
### Fixed
- `postDisconnectFlow` not executed when `disconnect()` manually

## [2.0.0] - 2022-02-24
### Changed
- Update deps

## [1.2.6] - 2022-01-06
### Fixed
- `cjs` to `js` to fix `react-scripts@5`

## [1.2.5] - 2021-12-29
### Changed
- Error code change: `ENCODE_REQ_ERR` -> `INPUT_DATA_ERR`

## [1.2.4] - 2021-12-19
### Added
- Websocket: attached `protocols` when `connect`
### Changed
- Optimized code

## [1.2.3] - 2021-12-03
### Added
- log `[SendMsgErr]`

## [1.2.0] - 2021-11-15
### Added
- Add new data type `json`

## [1.1.0] - 2021-11-08
### Added
- WebSocket Client support transfering as JSON
- JSON transfering support extended types such as `ArrayBuffer`, `Date`, `ObjectId`

## [1.0.15] - 2021-10-18
### Added
- Support for `mongodb/ObjectId`

## [1.0.14] - 2021-10-13
### Changed
- `BaseHttpClient` and `BaseWsClient` no longer have default type param

## [1.0.13] - 2021-10-09
### Fixed
- Fixed missing log when encode error

## [1.0.12] - 2021-10-08
### Changed
- Rename `index.cjs` to `index.js` to fit webpack
- Update `k8w-extend-native` to 1.4.6

## [1.0.11] - 2021-09-29
### Fixed
- `WsClient` 断开连接后对所有未尽 API 请求返回错误
### Changed
- `timeout` 默认 15 秒

## [1.0.10] - 2021-09-01
### Changed
- `listenMsg` 的监听函数类型改为 `(msg, msgName)=>void` 

## [1.0.9] - 2021-08-30
### Fixed
- `logger.error` when `sendBuf` error

## [1.0.8] - 2021-08-14

### Changed
- `listenMsg` 的监听函数类型改为 `(msg, msgName, client)=>void` 
## [1.0.7] - 2021-07-21

### Changed
- `callApi` 返回错误非业务错误时，通过 `logger.error` 打印日志而不是 `logger.log`。