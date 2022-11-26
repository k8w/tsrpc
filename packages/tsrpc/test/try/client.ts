import { HttpClient } from "../../src";
import { serviceProto } from "../proto/serviceProto";

const client = new HttpClient(serviceProto, {
    logLevel: 'debug',
    json: true
});

(async function () {
    let ret1 = await client.callApi('Test', { name: "Peter" });
    console.log('ret1', ret1)
})();