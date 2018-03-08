import * as path from 'path';
import RpcServer from '../src/TsrpcServer';
import PtlHelloWorld from '../test/protocol/PtlHelloWorld';
import ApiHelloWorld from '../test/api/ApiHelloWorld';

let server = new RpcServer({
    protocolPath: path.resolve(__dirname, 'protocol'),
    binaryTransport: true
});
server.implementPtl(PtlHelloWorld, ApiHelloWorld);
server.start(9999);

console.trace('trace');
console.debug('debug');
console.log('log');
console.info('info');
console.warn('warn');
console.error('error');