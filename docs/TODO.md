- [ ] ts-interface-validator node_modules
- [ ] LOG
- [ ] BinaryTransport
- [ ] Client Hooks
 
```
req.rpcServer.config.logAllRequest && console.debug('[ApiRes]', req.rpcUrl, body);
console.error('[ApiErr]', req.rpcUrl, res.output);
```


### TEST
- [x] TSRPC Error 直接返回给前台 不500
- [x] 500
- [x] 404
- [ ] Use