import { TsrpcConfig } from '../../../src/models/TsrpcConfig';
import path from 'path';

const tsrpcConf: TsrpcConfig = {
    proto: [
        {
            ptlDir: path.resolve(__dirname, 'src/shared/protocols'),
            output: path.resolve(__dirname, 'src/shared/protocols/serviceProto.ts'),
            apiDir: path.resolve(__dirname, 'src/api'),
            docDir: path.resolve(__dirname, 'temp')
        }
    ],
    sync: [
        {
            from: 'src/shared',
            to: '../frontend/shared_symlink',
            type: 'symlink'
        },
        {
            from: 'src/shared',
            to: '../frontend/shared_copy',
            type: 'copy',
            clean: true
        }
    ],
    dev: {
        watch: 'src',
        // entry: 'src/index.ts',
    },
    // verbose: true
}
export default tsrpcConf;