module.exports = {
    require: [
        'ts-node/register',
        'src/index.ts'
    ],
    recursive: true,
    exit: true,
    bail: true,
    timeout: 999999
}