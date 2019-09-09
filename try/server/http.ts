import { serviceProto } from '../proto/serviceProto';
import * as path from "path";
import { TsrpcServer } from '../../index';

let server = new TsrpcServer({
    proto: serviceProto
});

server.dataFlow.push((data, conn) => {
    let httpReq = conn.options.httpReq;
    if (httpReq.method === 'GET') {
        conn.logger.log('url', httpReq.url);
        conn.logger.log('host', httpReq.headers.host);
        conn.options.httpRes.end('Hello~~~');
        return false;
    }

    return true;
})

server.autoImplementApi(path.resolve(__dirname, 'api'));
server.start();