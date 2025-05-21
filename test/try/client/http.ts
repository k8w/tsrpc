import { HttpClient } from "../../src/client/http/HttpClient"
import { serviceProto, ServiceType } from "../proto/serviceProto"
let client = new HttpClient<ServiceType>({
  server: "http://localhost:3000",
  proto: serviceProto,
})

async function main() {
  const P = 50,
    N = 1000
  let max = 0
  console.time(`test ${P}/${N}`)
  for (let i = 0, len = N / P; i < len; ++i) {
    let res = await Promise.all(
      Array.from({ length: P }, () => {
        let start = Date.now()
        return client.callApi("a/b/c/Test", { name: "123" }).then(() => Date.now() - start)
      })
    )
    max = Math.max(res.max(), max)
  }
  console.timeEnd(`test ${P}/${N}`)
  console.log("max", max)
}
main()
