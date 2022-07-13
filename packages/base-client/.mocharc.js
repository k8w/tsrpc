module.exports = {
    require: [
        'ts-node/register'
    ],
    exit: true,
    timeout: 999999,
    'preserve-symlinks': true,
    spec: [
        './test/**/*.test.ts',
    ],
    // fgrep: 'implement API manually'
}