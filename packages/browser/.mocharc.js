module.exports = {
    require: [
        'ts-node/register'
    ],
    exit: true,
    timeout: 999999,
    'preserve-symlinks': true,
    spec: [
        './test/cases/http.test.ts',
        './test/cases/httpJSON.test.ts',
        './test/cases/ws.test.ts',
    ],
    parallel: false,
    // 'expose-gc': true,
    // fgrep: 'Prune'
}