# CHANGELOG

## [2.4.5] - 2022-07-03
### Added
- Add global type declaration `TsrpcCliConfig`
- Add new CLI params `--ignore-error`
### Changed
- Make symlink as relative path
- Use `export default` in default ApiTemplate, so that you don't need rename function after rename API file
- Update type of `PtlTemplate` and `MsgTemplate`, support pure json configuration, so that you can `npx tsrpc-cli sync` without `npm i`

## [2.4.4] - 2022-06-10
### Added
- Add new option `sync.readonly` for `tsrpc.config.ts`
- Add new option `proto.resolveModule` for `tsrpc.config.ts`
### Fixed
- Create symlink failed on MacOS

## [2.4.3] - 2022-04-17
### Added
- `npm run proto` would fill blank `PtlXXX.ts` by template
- `npm run dev` would fill blank `PtlXXX.ts` by template at startup
- Support `unknown` type (Contributed by @seho)
### Fixed
- Fixed `npm run api` generated wrong files when multiple `proto` configs existed

## [2.4.2] - 2022-04-17
### Changed
- Link error would not interrupt dev and build process

## [2.4.1] - 2022-04-16
### Added
- Added `watch` options for `TsrpcConfig.proto`
### Changed
- `npm run dev` now would watch `src` instead of `shared/protocols` by default to update `serviceProto.ts`
- `npm run dev` now would trigger `npm run sync` automatically at the startup (if `autoSync` is `true`)
### Fixed
- Recreate symlink if project folder is moved

## [2.4.0] - 2022-02-09
### Added
- Update dependencies, support new schemas
### Fixed
- Doc error for `Pick` and `Omit` types

## [2.3.2] - 2022-01-09
### Fixed
- Remove `node-json-color-stringify` to fixed `LIBRETY LIBRETY LIBRETY` Bug

## [2.3.1] - 2021-12-25
### Added
- New command `tsrpc-cli init`, to generate `tsrpc.config.ts`

## [2.3.0] - 2021-12-17
### Added
- Rename command from `tsrpc` to `tsrpc-cli`
- `dev` command now support `--entry` to specific entry file like `tsrpc-cli dev --entry src/xxx.ts`
- `tsrpc-cli doc` support multiple level
- Add TOC in generated markdown by `tsrpc-cli doc`
### Fixed
- Comment of type alias was not generated

## [2.2.2] - 2021-12-01
### Changed
- `tsrpc doc` remove `tsapi.json`

## [2.2.1] - 2021-12-01
### Added
- Add `CodeTemplate`
### Changed
- `tsrpc.config.ts`
    - `proto.newPtlTemplate` renamed to `proto.ptlTemplate`
    - `proto.newMsgTemplate` renamed to `proto.msgTemplate`
    - `proto.newApiTemplate` renamed to `proto.apiTemplate`

## [2.2.0] - 2021-11-14
### Added
- `tsrpc doc`: Generate API document
- `TsrpcConfig.proto` add `docDir` option

## [2.1.0] - 2021-11-08
### Changed
- Update to `tsbuffer@2.1` `tsrpc@3.1`

## [2.0.12] - 2021-10-19
### Changed
- "创建 Symlink 授权失败" 时，加入重试机制。

## [2.0.11] - 2021-10-19
### Changed
- 提示文案修改

## [2.0.10] - 2021-10-18
### Added
- Support `bson/ObjectId`
## [2.0.9] - 2021-10-16
### Added
- `TsrpcConfig` 新增 `autoFillNewPtl`，自动填充新建的 `Ptl` 和 `Msg` 文件。
- `npm run dev` 期间，如果删除了 `Ptl`，则自动删除自动创建且未更改的 `Api` 文件。
- Windows 下创建 `Symlink` 无权限时，自动调起授权弹框，如果拒绝则提供选项创建为 `Junction`。
- `link` 时如果目标位置不为空，由询问确认改为自动清空目标。
- `npm run dev` 时，如果 `sync.type` 为 `copy`，而目标位置为 `Symlink` 或文件，则会自动清空目标位置并完成初次同步。
- 没有指定任何命令行参数时，默认 `--config tsrpc.config.ts`。
- 增加对 `mongodb/ObjectId` 的支持。

## [2.0.8] - 2021-10-05
### Fixed
- ServiceProto JSON 无改变但 TS 报错的情况也重新写入文件
- `serviceProto.ts` 代码报错时无法正确 watch Proto 变更的 BUG
- 解析旧 ServiceProto TS 编译报错时，采用正则匹配的方式跳过
- 协议丢失类型日志由 warn 改为 error
- 优化 `tsbuffer-proto-generator` 日志
- `Missing ...` 时改为报错并不生成 ServiceProto
- ServiceProto 生成出错时始终不启动 devServer

## [2.0.5] - 2021-09-30
### Added
- `tsrpc.config.ts` support and `--config` param for commands
- new `tsrpc build` and `tsrpc dev` command
- `index.d.ts`

## [2.0.4] - 2021-07-29
### Changed
- `tsrpc build` preserved `scripts` in `package.json`