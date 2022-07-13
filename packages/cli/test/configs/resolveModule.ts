import path from "path";
import { TsrpcConfig } from '../../src/models/TsrpcConfig';

const tsrpcConf: TsrpcConfig = {
    proto: [
        {
            ptlDir: path.resolve(__dirname, '../protocols_resolveModule'),
            output: path.resolve(__dirname, '../output/proto/serviceProto_resolveModule.ts'),
            resolveModule: v => v.startsWith('@aabbcc/') ? path.resolve(__dirname, '../protocols_resolveModule/base/', v.replace('@aabbcc/', '')) : v
        }
    ],
    dev: {
        watch: path.resolve(__dirname, '../src')
    },
    // verbose: true
}
export default tsrpcConf;