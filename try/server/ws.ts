import { TSRPCServer } from "../..";
import { serviceProto, ServiceType } from '../proto/serviceProto';
import { TSRPCError } from '../../src/models/TsrpcError';
import * as path from "path";

let server = new TSRPCServer<ServiceType & { session: any }>({
    wsPort: 3000,
    httpPort: 3001,
    proto: serviceProto,
    apiPath: path.resolve(__dirname, 'api'),

    onServerWillStop: conns => new Promise(rs => {
        console.log('onServerWillStop');
        conns.forEach(v => { console.log(v.connId) });

        setTimeout(() => {
            console.log('onServerWillStop 2');
            conns.forEach(v => { v.close() });
        }, 2000)

        setTimeout(rs, 8000);
    })
});

// server.implementApi('Test', call => {
//     if (Math.random() > 0.75) {
//         call.succ({
//             reply: 'Hello, ' + call.data.name
//         })
//     }
//     else if (Math.random() > 0.5) {
//         call.error('What the fuck??', { msg: '哈哈哈哈' })
//     }
//     else if (Math.random() > 0.25) {
//         throw new Error('这应该是InternalERROR')
//     }
//     else {
//         throw new TSRPCError('返回到前台的错误', 'ErrInfo');
//     }
// });

server.listenMsg('Chat', call => {
    if (Math.random() > 0.5) {
        call.conn.sendMsg('Chat', {
            channel: call.data.channel,
            userName: 'Reply',
            content: 'R-' + call.data.content,
            time: Date.now()
        })
    }
    else {

    }
})

server.start();

// setInterval(() => {
//     server.sendMsg(['1', '2'], 'Chat', {
//         channel: 123,
//         userName: 'System',
//         content: 'Lalala',
//         time: Date.now()
//     }).catch(e => { })
// }, 1000)

// 优雅的停止
// setTimeout(async () => {
//     console.time('stop')
//     await server.stop();
//     console.timeEnd('stop');
//     process.exit();
// }, 3000);