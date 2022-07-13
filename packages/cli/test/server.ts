import { HttpServer } from "tsrpc";
import { serviceProto } from './output/proto/serviceProto';

const server = new HttpServer(serviceProto, {
    port: 3030
});

server.start();