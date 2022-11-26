import * as path from "path";
import { HttpServer } from "../../src";
import { serviceProto } from "../proto/serviceProto";

const server = new HttpServer(serviceProto, {
    debugBuf: true,
    json: true
});

(async function () {
    await server.autoImplementApi(path.resolve(__dirname, '../api'));
    await server.start()
})();