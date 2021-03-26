import { TSRPCClient } from "..";
import { serviceProto, ServiceType } from './proto/serviceProto';

async function main() {
    setInterval(() => {
        for (let i = 0; i < 100; ++i) {
            let client = new TSRPCClient<ServiceType>({
                server: 'ws://127.0.0.1:3000',
                proto: serviceProto
            });

            client.connect().then(() => {
                client.callApi('a/b/c/Test1', { name: '小明同学' }).then(v => {
                    // console.log('成功', v)
                }).catch(e => {
                    console.error('错误', e.message)
                }).then(() => {
                    client.disconnect();
                });
            }).catch(e => {
                console.error('连接错误', e)
            })
        }
    }, 1000)
}

main();