import * as path from 'path';
import RpcServer from '../../src/RpcServer';
import PtlHelloWorld from './protocol/PtlHelloWorld';
import ApiHelloWorld from './api/ApiHelloWorld';

let server = new RpcServer({
    protocolPath: path.resolve(__dirname, 'protocol')
});
server.implementPtl(PtlHelloWorld, ApiHelloWorld);
server.start(3010);