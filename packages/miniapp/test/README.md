运行小程序单元测试
---

## 启动后端服务

```
cd test/server
npm install
npm start
```

## 启动小程序

```
cd test/miniapp
npm install
npm run build
```

然后使用微信开发者工具，导入项目 `test/miniapp` 运行即可。
单元测试日志，见控制台。