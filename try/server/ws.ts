import { serviceProto } from '../proto/serviceProto';
import * as path from "path";
import { TsrpcServerWs } from '../../index';

let server = new TsrpcServerWs({
    proto: serviceProto
});
server.autoImplementApi(path.resolve(__dirname, 'api'));
server.start();