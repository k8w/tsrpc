module.exports = {
    require: [
        'ts-node/register',
    ],
    spec: [
        './test/cases/proto.test.ts',
        './test/cases/sync.test.ts',
        './test/cases/link.test.ts',
        './test/cases/api.test.ts',
    ],
    exit: true,
    timeout: 999999
    // fgrep: 'without config'
}