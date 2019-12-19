import { benchmarkConfig } from './config/BenchmarkConfig';
import { HttpRunner } from './models/HTTPRunner';

const req = {
    a: 123456,
    b: 'Hello, World!',
    c: true,
    d: new Uint8Array(100000)
}

new HttpRunner(async function () {
    await this.callApi('Test', req);
}, benchmarkConfig).start();