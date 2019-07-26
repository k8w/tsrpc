import { serviceProto, ServiceType } from '../proto/serviceProto';
import { WsClient } from '../../src/client/ws/WsClient';
import SuperPromise from 'k8w-super-promise';
import { Func } from 'mocha';

async function main() {
    let client = new WsClient({
        server: 'ws://127.0.0.1:3000',
        proto: serviceProto,
        onStatusChange: v => {
            console.log('StatusChange', v);
        },
        // onLostConnection: () => {
        //     console.log('连接断开，2秒后重连');
        //     setTimeout(() => {
        //         client.connect().catch(() => { });
        //     }, 2000)
        // }
    });

    await client.connect();

    let cancel = client.callApi('Test', { name: 'XXXXXXXXXXXXX' }).catch(e => e);
    cancel.cancel();

    let res = await client.callApi('Test', { name: '小明同学' }).catch(e => e);
    console.log('Test Res', res);

    res = await client.callApi('a/b/c/Test', { name: '小明同学' }).catch(e => e);
    console.log('Test1 Res', res);

    // setInterval(async () => {
    //     try {
    //         let res = await client.callApi('Test', { name: '小明同学' });
    //         console.log('收到回复', res);
    //     }
    //     catch (e) {
    //         if (e.info === 'NETWORK_ERR') {
    //             return;
    //         }
    //         console.log('API错误', e)
    //     }
    // }, 1000);

    // client.listenMsg('Chat', msg => {
    //     console.log('收到MSG', msg);
    // });

    // setInterval(() => {
    //     try {
    //         client.sendMsg('Chat', {
    //             channel: 123,
    //             userName: '王小明',
    //             content: '你好',
    //             time: Date.now()
    //         }).catch(e => {
    //             console.log('SendMsg Failed', e.message)
    //         })
    //     }
    //     catch{ }
    // }, 1000)

    // #region Benchmark
    // let maxTime = 0;
    // let done = 0;
    // let startTime = Date.now();

    // setTimeout(() => {
    //     console.log('done', maxTime, done);
    //     process.exit();
    // }, 3000);

    // for (let i = 0; i < 10000; ++i) {
    //     client.callApi('Test', { name: '小明同学' }).then(() => {
    //         ++done;
    //         maxTime = Math.max(maxTime, Date.now() - startTime)
    //     })
    // }
    // #endregion    
}

main();