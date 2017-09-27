import * as path from 'path';
import RpcServer from './src/RpcServer';
import PtlHelloWorld from './test/HelloWorld/protocol/PtlHelloWorld';
import ApiHelloWorld from './test/HelloWorld/api/ApiHelloWorld';

let server = new RpcServer({
    protocolPath: path.resolve(__dirname, 'test/HelloWorld/protocol')
});
server.implementPtl(PtlHelloWorld, ApiHelloWorld);
server.start();

console.trace('trace');
console.debug('debug');
console.log('log');
console.info('info');
console.warn('warn');
console.error('error');