import { TsrpcConfig } from '../../src/models/TsrpcConfig';

export const conf: TsrpcConfig = {
    proto: [
        {
            ptlDir: 'protocols',
            output: 'output/proto/serviceProto.ts',
            apiDir: 'output/api'
        },
        {
            ptlDir: 'protocols',
            ignore: 'protocols/a/**',
            output: 'output/proto/serviceProto1.ts',
            apiDir: 'output/api'
        }
    ],
    sync: [
        {
            from: 'output/proto',
            to: 'output/sync/symlink',
            type: 'symlink'
        },
        {
            from: 'output/proto',
            to: 'output/sync/copy',
            type: 'copy'
        }
    ],
    // verbose: true
}