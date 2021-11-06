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
        './test/cases/httpJSON.test.ts',
        './test/cases/ws.test.ts',
        './test/cases/wsJSON.test.ts',
        './test/cases/inner.test.ts',
    ],
    // parallel: false,

    // 'expose-gc': true,
    // fgrep: 'implement API manually'
}