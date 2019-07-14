import { serviceProto } from '../proto/serviceProto';
import * as path from "path";
import { TsrpcServer } from '../../index';

let server = new TsrpcServer({
    proto: serviceProto
});
server.autoImplementApi(path.resolve(__dirname, 'api'));
server.start();