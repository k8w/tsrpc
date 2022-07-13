import { HttpServer } from '../../src/index';
import { serviceProto } from "../protocols/proto";

async function main() {
    let server = new HttpServer(serviceProto, {
        logger: {
            debug: () => { },
            log: () => { },
            error: console.error.bind(console),
            warn: console.warn.bind(console)
        }
    });

    server.implementApi('Test', call => {
        call.succ(call.req);
    });

    await server.start();

    setInterval(() => {
        let used = process.memoryUsage().heapUsed / 1024 / 1024;
        console.log(`内存: ${Math.round(used * 100) / 100} MB`);
    }, 2000)
}

main();