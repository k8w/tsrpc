import { serviceProto, ServiceType } from "../proto/serviceProto"
import * as path from "path"
import { TsrpcServerWs } from "../../index"

let server = new TsrpcServerWs<ServiceType>({
  proto: serviceProto,
})
server.start()

server.autoImplementApi(path.resolve(__dirname, "api"))
server.listenMsg("Chat", v => {
  v.conn.sendMsg("Chat", {
    channel: v.msg.channel,
    userName: "SYSTEM",
    content: "收到",
    time: Date.now(),
  })
})
