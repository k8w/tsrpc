import { ObjectId } from "bson"
import { assert } from "chai"
import chalk from "chalk"
import * as path from "path"
import { ServiceProto, TsrpcError, TsrpcErrorType } from "tsrpc-proto"
import { ApiCall, BaseServer, HttpConnection, MsgCall, TerminalColorLogger } from "../../src"
import { HttpClient } from "../../src/client/http/HttpClient"
import { HttpProxy } from "../../src/client/http/HttpProxy"
import { HttpServer } from "../../src/server/http/HttpServer"
import { PrefixLogger } from "../../src/server/models/PrefixLogger"
import { ApiTest as ApiAbcTest } from "../api/a/b/c/ApiTest"
import { ApiTest } from "../api/ApiTest"
import { MsgChat } from "../proto/MsgChat"
import { ReqTest, ResTest } from "../proto/PtlTest"
import { serviceProto, ServiceType } from "../proto/serviceProto"

const serverLogger = new PrefixLogger({
  prefixs: [chalk.bgGreen.white(" Server ")],
  logger: new TerminalColorLogger({ pid: "Server" }),
})
const clientLogger = new PrefixLogger({
  prefixs: [chalk.bgBlue.white(" Client ")],
  logger: new TerminalColorLogger({ pid: "Client" }),
})

const getProto = () => Object.merge({}, serviceProto) as ServiceProto<ServiceType>

async function testApi(server: HttpServer<ServiceType>, client: HttpClient<ServiceType>) {
  // Succ
  assert.deepStrictEqual(
    await client.callApi("Test", {
      name: "Req1",
    }),
    {
      isSucc: true,
      res: {
        reply: "Test reply: Req1",
      },
    }
  )
  assert.deepStrictEqual(
    await client.callApi("a/b/c/Test", {
      name: "Req2",
    }),
    {
      isSucc: true,
      res: {
        reply: "a/b/c/Test reply: Req2",
      },
    }
  )

  // Inner error
  for (let v of ["Test", "a/b/c/Test"]) {
    let ret = await client.callApi(v as any, {
      name: "InnerError",
    })
    delete ret.err!.innerErr.stack

    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("Internal Server Error", {
        code: "INTERNAL_ERR",
        type: TsrpcErrorType.ServerError,
        innerErr: `${v} InnerError`,
      }),
    })
  }

  // TsrpcError
  for (let v of ["Test", "a/b/c/Test"]) {
    let ret = await client.callApi(v as any, {
      name: "TsrpcError",
    })
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError(`${v} TsrpcError`, {
        code: "CODE_TEST",
        type: TsrpcErrorType.ApiError,
        info: "ErrInfo " + v,
      }),
    })
  }

  // call.error
  for (let v of ["Test", "a/b/c/Test"]) {
    let ret = await client.callApi(v as any, {
      name: "error",
    })
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("Got an error", {
        type: TsrpcErrorType.ApiError,
      }),
    })
  }
}

describe("HTTP JSON Server & Client basic", function () {
  it("implement API manually", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
      debugBuf: true,
    })
    await server.start()

    server.implementApi("Test", ApiTest)
    server.implementApi("a/b/c/Test", ApiAbcTest)

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
      debugBuf: true,
    })

    await testApi(server, client)

    await server.stop()
  })

  it("extend call in handler", function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
      debugBuf: true,
    })

    type MyApiCall<Req, Res> = ApiCall<Req, Res> & {
      value1?: string
      value2: string
    }
    type MyMsgCall<Msg> = MsgCall<Msg> & {
      value1?: string
      value2: string
    }

    server.implementApi("Test", (call: MyApiCall<ReqTest, ResTest>) => {
      call.value1 = "xxx"
      call.value2 = "xxx"
    })
    server.listenMsg("Chat", (call: MyMsgCall<MsgChat>) => {
      call.msg.content
      call.value1 = "xxx"
      call.value2 = "xxx"
    })
  })

  it("extend call in flow", function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
      debugBuf: true,
    })

    type MyApiCall<Req, Res> = ApiCall<Req, Res> & {
      value1?: string
      value2: string
    }
    type MyMsgCall<Msg> = MsgCall<Msg> & {
      value1?: string
      value2: string
    }
    type MyConn = HttpConnection<any> & {
      currentUser: {
        uid: string
        nickName: string
      }
    }

    server.flows.postConnectFlow.push((conn: MyConn) => {
      conn.currentUser.nickName = "asdf"
      return conn
    })
    server.flows.postConnectFlow.exec(null as any as MyConn, console)
    server.flows.preApiCallFlow.push((call: MyApiCall<any, any>) => {
      call.value2 = "x"
      return call
    })
    server.flows.preSendMsgFlow.push((call: MyMsgCall<any>) => {
      call.value2 = "f"
      return call
    })
  })

  it("autoImplementApi", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
      apiTimeout: 5000,
    })
    await server.start()

    server.autoImplementApi(path.resolve(__dirname, "../api"))

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    await testApi(server, client)

    await server.stop()
  })

  it("sendMsg", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      port: 3001,
      logger: serverLogger,
      // debugBuf: true
    })

    await server.start()

    let client = new HttpClient(getProto(), {
      json: true,
      server: "http://127.0.0.1:3001",
      logger: clientLogger,
      // debugBuf: true
    })

    return new Promise(rs => {
      let msg: MsgChat = {
        channel: 123,
        userName: "fff",
        content: "666",
        time: Date.now(),
      }

      server.listenMsg("Chat", async v => {
        assert.deepStrictEqual(v.msg, msg)
        await server.stop()
        rs()
      })

      client.sendMsg("Chat", msg)
    })
  })

  it("Same-name msg and api", async function () {
    let server = new HttpServer(getProto(), {
      port: 3001,
      json: true,
      logger: serverLogger,
      // debugBuf: true
    })

    await server.autoImplementApi(path.resolve(__dirname, "../api"))
    await server.start()

    let client = new HttpClient(getProto(), {
      server: "http://127.0.0.1:3001",
      json: true,
      logger: clientLogger,
      // debugBuf: true
    })

    let ret = await client.callApi("Test", { name: "xxx" })
    assert.ok(ret.isSucc)

    return new Promise(rs => {
      server.listenMsg("Test", async v => {
        assert.deepStrictEqual(v.msg, { content: "abc" })
        await server.stop()
        rs()
      })

      client.sendMsg("Test", {
        content: "abc",
      })
    })
  })

  it("abort", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })
    await server.start()

    server.autoImplementApi(path.resolve(__dirname, "../api"))

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    let result: any | undefined
    let promise = client.callApi("Test", { name: "aaaaaaaa" })
    let sn = client.lastSN
    setTimeout(() => {
      client.abort(sn)
    }, 10)
    promise.then(v => {
      result = v
    })

    await new Promise<void>(rs => {
      setTimeout(() => {
        assert.strictEqual(result, undefined)
        rs()
      }, 150)
    })

    await server.stop()
  })

  it("abortByKey", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })
    await server.start()

    server.autoImplementApi(path.resolve(__dirname, "../api"))

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    let result: any | undefined
    let result1: any | undefined

    client.callApi("Test", { name: "aaaaaaaa" }, { abortKey: "XXX" }).then(v => {
      result = v
    })
    client.callApi("Test", { name: "aaaaaaaa" }, { abortKey: "XXX" }).then(v => {
      result = v
    })
    client.callApi("Test", { name: "aaaaaaaa" }, { abortKey: "XXX" }).then(v => {
      result = v
    })
    client.callApi("Test", { name: "aaaaaaaa" }, { abortKey: "XXX" }).then(v => {
      result = v
    })
    client.callApi("Test", { name: "aaaaaaaa" }, { abortKey: "XXX" }).then(v => {
      result = v
    })

    client.callApi("Test", { name: "bbbbbb" }).then(v => {
      result1 = v
    })

    setTimeout(() => {
      client.abortByKey("XXX")
    }, 10)

    await new Promise<void>(rs => {
      setTimeout(() => {
        assert.strictEqual(result, undefined)
        assert.deepStrictEqual(result1, {
          isSucc: true,
          res: {
            reply: "Test reply: bbbbbb",
          },
        })
        rs()
      }, 150)
    })

    await server.stop()
  })

  it("abortAll", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })
    await server.start()

    server.autoImplementApi(path.resolve(__dirname, "../api"))

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    let result: any | undefined
    let result1: any | undefined

    client.callApi("Test", { name: "aaaaaaaa" }, { abortKey: "XXX" }).then(v => {
      result = v
    })
    client.callApi("Test", { name: "aaaaaaaa" }, { abortKey: "XXX" }).then(v => {
      result = v
    })
    client.callApi("Test", { name: "aaaaaaaa" }, { abortKey: "XXX" }).then(v => {
      result = v
    })
    client.callApi("Test", { name: "aaaaaaaa" }, { abortKey: "XXX" }).then(v => {
      result = v
    })
    client.callApi("Test", { name: "aaaaaaaa" }, { abortKey: "XXX" }).then(v => {
      result = v
    })

    client.callApi("Test", { name: "bbbbbb" }).then(v => {
      result1 = v
    })

    setTimeout(() => {
      client.abortAll()
    }, 10)

    await new Promise<void>(rs => {
      setTimeout(() => {
        assert.strictEqual(result, undefined)
        assert.strictEqual(result1, undefined)
        rs()
      }, 150)
    })

    await server.stop()
  })

  it("pendingApis", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })
    await server.start()

    server.autoImplementApi(path.resolve(__dirname, "../api"))

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    for (let i = 0; i < 10; ++i) {
      let promise = Promise.all(
        Array.from(
          { length: 10 },
          () =>
            new Promise<void>(rs => {
              let name = ["Req", "InnerError", "TsrpcError", "error"][(Math.random() * 4) | 0]
              let ret: any | undefined
              let promise = client.callApi("Test", { name: name })
              let sn = client.lastSN
              let abort = Math.random() > 0.5
              if (abort) {
                setTimeout(() => {
                  client.abort(sn)
                }, 0)
              }
              promise.then(v => {
                ret = v
              })

              setTimeout(() => {
                client.logger?.log("sn", sn, name, abort, ret)
                if (abort) {
                  assert.strictEqual(ret, undefined)
                } else {
                  assert.notEqual(ret, undefined)
                  if (name === "Req") {
                    assert.strictEqual(ret.isSucc, true)
                  } else {
                    assert.strictEqual(ret.isSucc, false)
                  }
                }
                rs()
              }, 300)
            })
        )
      )
      assert.strictEqual(client["_pendingApis"].length, 10)
      await promise
      assert.strictEqual(client["_pendingApis"].length, 0)
    }

    await server.stop()
  })

  it("error", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })
    await server.start()

    let client1 = new HttpClient(getProto(), {
      json: true,
      server: "http://localhost:80",
      logger: clientLogger,
    })

    let ret = await client1.callApi("Test", { name: "xx" })
    console.log(ret)
    assert.strictEqual(ret.isSucc, false)
    assert.strictEqual(ret.err?.code, "ECONNREFUSED")
    assert.strictEqual(ret.err?.type, TsrpcErrorType.NetworkError)

    await server.stop()
  })

  it("server timeout", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
      apiTimeout: 100,
    })
    server.implementApi("Test", call => {
      return new Promise(rs => {
        setTimeout(() => {
          call.req &&
            call.succ({
              reply: "Hi, " + call.req.name,
            })
          rs()
        }, 200)
      })
    })
    await server.start()

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })
    let ret = await client.callApi("Test", { name: "Jack" })
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("Server Timeout", {
        code: "SERVER_TIMEOUT",
        type: TsrpcErrorType.ServerError,
      }),
    })

    await server.stop()
  })

  it("client timeout", async function () {
    let server1 = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })
    server1.implementApi("Test", call => {
      return new Promise(rs => {
        setTimeout(() => {
          call.succ({
            reply: "Hello, " + call.req.name,
          })
          rs()
        }, 2000)
      })
    })
    await server1.start()

    let client = new HttpClient(getProto(), {
      json: true,
      timeout: 100,
      logger: clientLogger,
    })

    let ret = await client.callApi("Test", { name: "Jack123" })
    // SERVER TIMEOUT的call还没执行完，但是call却被放入Pool了，导致这个BUG
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError({
        message: "Request timeout",
        code: "ECONNABORTED",
        type: TsrpcErrorType.NetworkError,
      }),
    })
    await server1.stop()
  })

  it("Graceful stop", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })

    let reqNum = 0
    server.implementApi("Test", async call => {
      if (++reqNum === 10) {
        server.gracefulStop()
      }
      await new Promise(rs => setTimeout(rs, parseInt(call.req.name)))
      call.succ({ reply: "OK" })
    })

    await server.start()
    let isStopped = false

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    let succNum = 0
    await Promise.all(
      Array.from({ length: 10 }, (v, i) =>
        client.callApi("Test", { name: "" + i * 100 }).then(v => {
          if (v.res?.reply === "OK") {
            ++succNum
          }
        })
      )
    )
    assert.strictEqual(succNum, 10)
  })
})

describe("HTTP JSON Flows", function () {
  it("Server conn flow", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })

    const flowExecResult: { -readonly [K in keyof BaseServer["flows"]]?: boolean } = {}

    server.implementApi("Test", async call => {
      assert.strictEqual((call.conn as any).xxxx, "asdfasdf")
      assert.strictEqual(flowExecResult.postConnectFlow, true)
      assert.strictEqual(flowExecResult.postDisconnectFlow, undefined)
      call.succ({ reply: "ok" })
      assert.strictEqual(flowExecResult.postDisconnectFlow, undefined)
    })

    server.flows.postConnectFlow.push(v => {
      flowExecResult.postConnectFlow = true
      ;(v as any).xxxx = "asdfasdf"
      return v
    })
    server.flows.postDisconnectFlow.push(v => {
      flowExecResult.postDisconnectFlow = true
      return v
    })

    await server.start()

    assert.strictEqual(flowExecResult.postConnectFlow, undefined)
    assert.strictEqual(flowExecResult.postDisconnectFlow, undefined)

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })
    await client.callApi("Test", { name: "xxx" })
    assert.strictEqual(flowExecResult.postConnectFlow, true)
    assert.strictEqual(flowExecResult.postDisconnectFlow, true)

    await server.stop()
  })

  it("Buffer enc/dec flow", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })

    const flowExecResult: { -readonly [K in keyof BaseServer["flows"]]?: boolean } = {}

    server.implementApi("Test", async call => {
      call.succ({ reply: "Enc&Dec" })
    })

    server.flows.preRecvDataFlow.push(v => {
      flowExecResult.preRecvDataFlow = true
      v.data = (v.data as string).split("").reverse().join("")
      return v
    })
    server.flows.preSendDataFlow.push(v => {
      flowExecResult.preSendDataFlow = true
      v.data = (v.data as string).split("").reverse().join("")
      return v
    })

    await server.start()

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    client.flows.preSendDataFlow.push(v => {
      v.data = (v.data as string).split("").reverse().join("")
      return v
    })

    client.flows.preRecvDataFlow.push(v => {
      v.data = (v.data as string).split("").reverse().join("")
      return v
    })

    let ret = await client.callApi("Test", { name: "xxx" })
    assert.strictEqual(flowExecResult.preRecvDataFlow, true)
    assert.strictEqual(flowExecResult.preSendDataFlow, true)
    assert.deepStrictEqual(ret, {
      isSucc: true,
      res: {
        reply: "Enc&Dec",
      },
    })

    await server.stop()
  })

  it("ApiCall flow", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })

    const flowExecResult: { -readonly [K in keyof BaseServer["flows"]]?: boolean } = {}

    server.implementApi("Test", async call => {
      call.succ({ reply: "asdgasdgasdgasdg" })
    })

    server.flows.preApiCallFlow.push(call => {
      assert.strictEqual(call.req.name, "Changed")
      call.error("You need login")
      return call
    })
    server.flows.postApiCallFlow.push(v => {
      flowExecResult.postApiCallFlow = true
      return v
    })

    await server.start()

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    client.flows.preCallApiFlow.push(v => {
      if (v.apiName !== "ObjId") {
        v.req.name = "Changed"
      }
      return v
    })

    let ret = await client.callApi("Test", { name: "xxx" })
    assert.strictEqual(flowExecResult.postApiCallFlow, true)
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("You need login"),
    })

    await server.stop()
  })

  it("ApiCall flow break", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })

    const flowExecResult: { -readonly [K in keyof BaseServer["flows"]]?: boolean } = {}

    server.implementApi("Test", async call => {
      call.succ({ reply: "asdgasdgasdgasdg" })
    })

    server.flows.preApiCallFlow.push(call => {
      assert.strictEqual(call.req.name, "Changed")
      call.error("You need login")
      return undefined
    })
    server.flows.postApiCallFlow.push(v => {
      flowExecResult.postApiCallFlow = true
      return v
    })

    await server.start()

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    client.flows.preCallApiFlow.push(v => {
      if (v.apiName !== "ObjId") {
        v.req.name = "Changed"
      }
      return v
    })

    let ret = await client.callApi("Test", { name: "xxx" })
    assert.strictEqual(flowExecResult.postApiCallFlow, undefined)
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("You need login"),
    })

    await server.stop()
  })

  it("ApiCall flow error", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })

    const flowExecResult: { -readonly [K in keyof BaseServer["flows"]]?: boolean } = {}

    server.implementApi("Test", async call => {
      call.succ({ reply: "asdgasdgasdgasdg" })
    })

    server.flows.preApiCallFlow.push(call => {
      assert.strictEqual(call.req.name, "Changed")
      throw new Error("ASDFASDF")
    })
    server.flows.postApiCallFlow.push(v => {
      flowExecResult.postApiCallFlow = true
      return v
    })

    await server.start()

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    client.flows.preCallApiFlow.push(v => {
      if (v.apiName !== "ObjId") {
        v.req.name = "Changed"
      }
      return v
    })

    let ret = await client.callApi("Test", { name: "xxx" })
    assert.strictEqual(flowExecResult.postApiCallFlow, undefined)
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("Internal Server Error", {
        type: TsrpcErrorType.ServerError,
        innerErr: "ASDFASDF",
        code: "INTERNAL_ERR",
      }),
    })

    await server.stop()
  })

  it("server ApiReturn flow", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })

    const flowExecResult: { -readonly [K in keyof BaseServer["flows"]]?: boolean } = {}

    server.implementApi("Test", async call => {
      call.succ({ reply: "xxxxxxxxxxxxxxxxxxxx" })
    })

    server.flows.preApiReturnFlow.push(v => {
      flowExecResult.preApiReturnFlow = true
      v.return = {
        isSucc: false,
        err: new TsrpcError("Ret changed"),
      }
      return v
    })
    server.flows.postApiReturnFlow.push(v => {
      flowExecResult.postApiReturnFlow = true
      v.call.logger.log("RETTT", v.return)
      return v
    })

    await server.start()

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    let ret = await client.callApi("Test", { name: "xxx" })
    assert.strictEqual(flowExecResult.preApiReturnFlow, true)
    assert.strictEqual(flowExecResult.postApiReturnFlow, true)
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("Ret changed"),
    })

    await server.stop()
  })

  it("client ApiReturn flow", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })

    const flowExecResult: { -readonly [K in keyof HttpClient<any>["flows"]]?: boolean } = {}

    server.implementApi("Test", async call => {
      call.succ({ reply: "xxxxxxxxxxxxxxxxxxxx" })
    })

    await server.start()

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    client.flows.preApiReturnFlow.push(v => {
      flowExecResult.preApiReturnFlow = true
      v.return = {
        isSucc: false,
        err: new TsrpcError("Ret changed"),
      }
      return v
    })
    client.flows.postApiReturnFlow.push(v => {
      flowExecResult.postApiReturnFlow = true
      client.logger?.log("RETTT", v.return)
      return v
    })

    let ret = await client.callApi("Test", { name: "xxx" })
    assert.strictEqual(flowExecResult.preApiReturnFlow, true)
    assert.strictEqual(flowExecResult.postApiReturnFlow, true)
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("Ret changed"),
    })

    await server.stop()
  })

  it("client SendBufferFlow prevent", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })

    // const flowExecResult: { [K in (keyof BaseClient<any>['flows'])]?: boolean } = {};

    server.implementApi("Test", async call => {
      call.succ({ reply: "xxxxxxxxxxxxxxxxxxxx" })
    })

    await server.start()

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    client.flows.preSendDataFlow.push(v => {
      return undefined
    })

    let ret: any
    client.callApi("Test", { name: "xxx" }).then(v => {
      ret = v
    })
    await new Promise(rs => {
      setTimeout(rs, 200)
    })
    assert.strictEqual(ret, undefined)

    await server.stop()
  })

  it("onInputBufferError", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })
    await server.start()

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })
    client.flows.preSendDataFlow.push(v => {
      v.data = (v.data as string).split("").reverse().join("")
      return v
    })

    let ret = await client.callApi("Test", { name: "XXX" })
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError(
        'Input is not a valid JSON string: Unexpected token \'}\', "}"XXX":"eman"{" is not valid JSON',
        {
          type: TsrpcErrorType.ServerError,
          code: "INPUT_DATA_ERR",
        }
      ),
    })

    await server.stop()
  })

  it("throw type error in client", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })
    await server.start()

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    let ret = await client.callApi("Test", { name: 23456 } as any)
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError({
        code: "INPUT_DATA_ERR",
        message: "Property `name`: Expected type to be `string`, actually `number`.",
        type: TsrpcErrorType.ClientError,
      }),
    })

    await server.stop()
  })

  it("throw type error in server", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })
    await server.start()

    let retHttp = await new HttpProxy().fetch({
      url: "http://127.0.0.1:3000/Test",
      data: JSON.stringify({ name: 12345 }),
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      transportOptions: {},
      responseType: "text",
    }).promise

    assert.deepStrictEqual(JSON.parse((retHttp as any).res), {
      isSucc: false,
      err: {
        code: "INPUT_DATA_ERR",
        message: "Property `name`: Expected type to be `string`, actually `number`.",
        type: TsrpcErrorType.ServerError,
      },
    })

    await server.stop()
  })

  it("ObjectId", async function () {
    let server = new HttpServer(getProto(), {
      json: true,
      logger: serverLogger,
    })
    server.autoImplementApi(path.resolve(__dirname, "../api"))
    await server.start()

    let client = new HttpClient(getProto(), {
      json: true,
      logger: clientLogger,
    })

    // ObjectId
    let objId1 = new ObjectId()
    let ret = await client.callApi("ObjId", {
      id1: objId1,
    })
    assert.strictEqual(ret.isSucc, true, ret.err?.message)
    assert.strictEqual(objId1.toString(), ret.res!.id2.toString())

    await server.stop()
  })
})
