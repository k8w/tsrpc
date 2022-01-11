import { benchmarkConfig } from './config/BenchmarkConfig';
import { WsRunner } from './models/WsRunner';

const req = {
    a: 123456,
    b: 'Hello, World!',
    c: true,
    d: new Uint8Array(100000)
}

new WsRunner(async function () {
    await this.callApi('Test', req);
}, benchmarkConfig).start();