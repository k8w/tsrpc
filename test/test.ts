import { HttpServer } from "../src/server/http/HttpServer"
import { serviceProto } from "./proto/serviceProto"

let server = new HttpServer(serviceProto, {
  jsonEnabled: true,
  jsonRootPath: "api",
})

server.implementApi("a/b/c/Test", call => {
  call.logger.log("xxx", call.req)
  call.succ({
    reply: "xxxxxxxxxxx",
    aasdg: "d",
    b: "asdg",
  } as any)
})

server.start()
