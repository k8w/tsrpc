import { TsrpcClient } from "../../.."
import { serviceProto } from "../server/protocols/proto"

let client = new TsrpcClient({
  proto: serviceProto,
})

client
  .callApi("Test", { name: "ssss" })
  .then(v => {
    console.log("then", v)
  })
  .catch(e => {
    console.log("catch", e)
  })
