import { HttpServer } from "./src/server/http/HttpServer";
import { serviceProto } from "./test/proto/serviceProto";
import { PrefixLogger } from "./src/server/Logger";
import { HttpClient } from "./src/client/http/HttpClient";

const serverLogger = PrefixLogger.pool.get({
    prefix: '[Server Log]',
    logger: console
});
const clientLogger = PrefixLogger.pool.get({
    prefix: '[Client Log]',
    logger: console
})

async function main() {
    let server = new HttpServer({
        proto: serviceProto,
        logger: serverLogger,
        timeout: 3000
    });
    server.implementApi('Test', async call => {
        await new Promise(rs => {
            setTimeout(() => {
                call.succ({
                    reply: 'Hi, ' + call.req.name
                });
                rs();
            }, 6000)
        })
    })
    await server.start();

    let client = new HttpClient({
        proto: serviceProto,
        logger: clientLogger
    });
    let result = await client.callApi('Test', { name: 'Jack' }).catch(e => e);

    console.log('rerrrrrrrrr', result)
}

main();