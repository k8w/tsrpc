function test1(box, skipSN) {
  const protoInfo = box.protoInfo;
  return {
    isSucc: true,
    res:
      `{"type":"${box.type}",` + // type
      (box.type === 'req' ? `"apiName":"${box.apiName}",` : '') + // apiName
      (skipSN ? '' : `"sn":${box.sn},`) + // sn
      (protoInfo
        ? `"protoInfo":{"lastModified":"${protoInfo.lastModified}","md5":"${
            protoInfo.md5
          }","tsrpcVersion":"${protoInfo.tsrpcVersion}",${
            protoInfo.nodeVersion
              ? `,"nodeVersion":"${protoInfo.nodeVersion}"`
              : ''
          }},`
        : '') + //protoInfo
      `"body":${JSON.stringify(box.body)}}`, // body
  };
}
function test2(box) {
  return JSON.stringify(box);
}

const test3 = eval(
  '(box, skipSN) =>{\n    const protoInfo = box.protoInfo;\n    return {\n        isSucc: true,\n        res: `{"type":"${box.type}",`    // type\n            + (box.type === \'req\' ? `"apiName":"${box.apiName}",` : \'\') // apiName\n            + (skipSN ? \'\' : `"sn":${box.sn},`) // sn\n            + (protoInfo ? `"protoInfo":{"lastModified":"${protoInfo.lastModified}","md5":"${protoInfo.md5}","tsrpcVersion":"${protoInfo.tsrpcVersion}",${protoInfo.nodeVersion ? `,"nodeVersion":"${protoInfo.nodeVersion}"` : \'\'}},` : \'\') //protoInfo\n            + `"body":${JSON.stringify(box.body)}}` // body\n    };\n}'
);

let box = {
  type: 'req',
  apiName: 'xasdg/asgeab',
  sn: 123,
  protoInfo: {
    nodeVersion: '12.x',
    lastModified: '2022-08-16 19:09:05',
    md5: 'abcdef1234567890qwertyui',
    tsrpcVersion: '3.4.5',
  },
  body: {
    userId: 'aaaabbbbccccc',
    amount: 12356,
    testData: {
      aaa: 'asdf',
      bbb: true,
      ccc: [1, 2, 3, 4],
    },
  },
};

for (let i = 0; i < 10; ++i) {
  console.time('test1');
  for (let i = 0; i < 1000000; ++i) {
    test1(box, false);
  }
  console.timeEnd('test1');

  console.time('test2');
  for (let i = 0; i < 1000000; ++i) {
    test2(box);
  }
  console.timeEnd('test2');

  console.time('test3');
  for (let i = 0; i < 1000000; ++i) {
    test3(box, false);
  }
  console.timeEnd('test3');
}
