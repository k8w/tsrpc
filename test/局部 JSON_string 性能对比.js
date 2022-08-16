function test1(box, skipSN) {
    const protoInfo = box.protoInfo;
    return {
        isSucc: true,
        res: `{"type":"${box.type}",`    // type
            + (skipSN ? '' : `"sn":${box.sn},`) // sn
            + (protoInfo ? `"protoInfo":{"lastModified":"${protoInfo.lastModified}","md5":"${protoInfo.md5}","tsrpcVersion":"${protoInfo.tsrpcVersion}",${protoInfo.nodeVersion ? `,"nodeVersion":"${protoInfo.nodeVersion}"` : ''}},` : '') //protoInfo
            + `"err":"${JSON.stringify(box.err)}"}` // body
    };
}
function test2(box) {
    return JSON.stringify(box);
}

let box = {
    type: 'req',
    sn: 123,
    protoInfo: {
        nodeVersion: '12.x',
        lastModified: '2022-08-16 19:09:05',
        md5: 'abcdef1234567890qwertyui',
        tsrpcVersion: '3.4.5'
    },
    err: {
        message: "这是一段错误的信息",
        type: 'ApiError',
        code: 'UNKONWN_ERR'
    }
}

for (let i = 0; i < 10; ++i) {
    console.time('test1')
    for (let i = 0; i < 1000000; ++i) {
        test1(box, false)
    }
    console.timeEnd('test1')

    console.time('test2')
    for (let i = 0; i < 1000000; ++i) {
        test2(box)
    }
    console.timeEnd('test2')
}