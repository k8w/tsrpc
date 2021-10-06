# CHANGELOG

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