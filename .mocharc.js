module.exports = {
    require: [
        'ts-node/register',
        './test/Base.ts'
    ],
    exit: true,
    timeout: 999999,
    'preserve-symlinks': true,
    spec: [
        './test/cases/http.test.ts',
    ],
    parallel: false,
    // 'expose-gc': true,
    fgrep: 'flow'
}