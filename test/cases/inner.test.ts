import { ObjectId } from "bson"
import { assert } from "chai"
import chalk from "chalk"
import * as path from "path"
import { ServiceProto, TsrpcError, TsrpcErrorType } from "tsrpc-proto"
import { ApiCall, BaseServer, HttpConnection, MsgCall, TerminalColorLogger } from "../../src"
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

const getProto = () => Object.merge({}, serviceProto) as ServiceProto<ServiceType>

async function testApi(server: HttpServer<ServiceType>) {
  // Succ
  assert.deepStrictEqual(
    await server.callApi("Test", {
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
    await server.callApi("a/b/c/Test", {
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
    let ret = await server.callApi(v as any, {
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
    let ret = await server.callApi(v as any, {
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
    let ret = await server.callApi(v as any, {
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

describe("HTTP Server & Client basic", function () {
  it("implement API manually", async function () {
    let server = new HttpServer(getProto(), {
      logger: serverLogger,
      debugBuf: true,
    })

    server.implementApi("Test", ApiTest)
    server.implementApi("a/b/c/Test", ApiAbcTest)

    await testApi(server)
  })

  it("extend call in handler", function () {
    let server = new HttpServer(getProto(), {
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
      logger: serverLogger,
      apiTimeout: 5000,
    })

    await server.autoImplementApi(path.resolve(__dirname, "../api"))

    await testApi(server)
  })

  it("autoImplementApi delay", async function () {
    let server = new HttpServer(getProto(), {
      logger: serverLogger,
      apiTimeout: 5000,
    })

    server.autoImplementApi(path.resolve(__dirname, "../api"), true)

    await testApi(server)
  })

  it("error", async function () {
    let server = new HttpServer(getProto(), {
      logger: serverLogger,
    })

    let ret = await server.callApi("TesASFt" as any, { name: "xx" } as any)
    console.log(ret)
    assert.strictEqual(ret.isSucc, false)
    assert.strictEqual(ret.err?.code, "ERR_API_NAME")
    assert.strictEqual(ret.err?.type, TsrpcErrorType.ServerError)
  })

  it("server timeout", async function () {
    let server = new HttpServer(getProto(), {
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

    let ret = await server.callApi("Test", { name: "Jack" })
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("Server Timeout", {
        code: "SERVER_TIMEOUT",
        type: TsrpcErrorType.ServerError,
      }),
    })
  })

  it("Graceful stop", async function () {
    let server = new HttpServer(getProto(), {
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

    let isStopped = false

    let succNum = 0
    await Promise.all(
      Array.from({ length: 10 }, (v, i) =>
        server.callApi("Test", { name: "" + i * 100 }).then(v => {
          if (v.res?.reply === "OK") {
            ++succNum
          }
        })
      )
    )
    assert.strictEqual(succNum, 10)
  })
})

describe("HTTP Flows", function () {
  it("ApiCall flow", async function () {
    let server = new HttpServer(getProto(), {
      logger: serverLogger,
    })

    server.implementApi("Test", async call => {
      call.succ({ reply: "asdgasdgasdgasdg" })
    })

    server.flows.preApiCallFlow.push(call => {
      if (call.req.apiName !== "ObjId") {
        call.req.name = "Changed"
      }
      return call
    })

    server.flows.preApiCallFlow.push(call => {
      assert.strictEqual(call.req.name, "Changed")
      call.error("You need login")
      return call
    })

    let ret = await server.callApi("Test", { name: "xxx" })
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("You need login"),
    })
  })

  it("ApiCall flow break", async function () {
    let server = new HttpServer(getProto(), {
      logger: serverLogger,
    })

    const flowExecResult: { -readonly [K in keyof BaseServer["flows"]]?: boolean } = {}

    server.implementApi("Test", async call => {
      call.succ({ reply: "asdgasdgasdgasdg" })
    })

    server.flows.preApiCallFlow.push(call => {
      call.error("You need login")
      return undefined
    })

    let ret = await server.callApi("Test", { name: "xxx" })
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("You need login"),
    })
  })

  it("ApiCall flow error", async function () {
    let server = new HttpServer(getProto(), {
      logger: serverLogger,
    })

    const flowExecResult: { -readonly [K in keyof BaseServer["flows"]]?: boolean } = {}

    server.implementApi("Test", async call => {
      call.succ({ reply: "asdgasdgasdgasdg" })
    })

    server.flows.preApiCallFlow.push(call => {
      throw new Error("ASDFASDF")
    })

    let ret = await server.callApi("Test", { name: "xxx" })
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("Internal Server Error", {
        type: TsrpcErrorType.ServerError,
        innerErr: "ASDFASDF",
        code: "INTERNAL_ERR",
      }),
    })
  })

  it("server ApiReturn flow", async function () {
    let server = new HttpServer(getProto(), {
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

    let ret = await server.callApi("Test", { name: "xxx" })
    assert.strictEqual(flowExecResult.preApiReturnFlow, true)
    assert.deepStrictEqual(ret, {
      isSucc: false,
      err: new TsrpcError("Ret changed"),
    })
  })

  it("Extended JSON Types", async function () {
    let server = new HttpServer(getProto(), {
      logger: serverLogger,
    })
    await server.autoImplementApi(path.resolve(__dirname, "../api"))

    let buf = new Uint8Array([0, 1, 2, 3, 255, 254, 253, 252])
    let date = new Date("2021/11/17")

    // ObjectId
    let objId1 = new ObjectId()
    let ret = await server.callApi("ObjId", {
      id1: objId1,
      buf: buf,
      date: date,
    })
    assert.deepStrictEqual(ret, {
      isSucc: true,
      res: {
        id2: objId1,
        buf: buf,
        date: date,
      },
    })
  })
})
