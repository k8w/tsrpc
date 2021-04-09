module.exports = {
    require: [
        'ts-node/register',
        './test/Base.ts'
    ],
    exit: true,
    timeout: 999999,
    'preserve-symlinks': true,
    spec: [
        './test/http.test.ts',
    ],
    parallel: false
}