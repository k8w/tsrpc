import { TsrpcServer } from "../../../index"
import { serviceProto } from "./protocols/proto"

let server = new TsrpcServer({
  proto: serviceProto,
})

server.autoImplementApi("src/api")

server.start()
