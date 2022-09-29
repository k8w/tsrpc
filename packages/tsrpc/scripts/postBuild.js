const fs = require('fs');
const path = require('path');

// remove private / protected index.d.ts
// (() => {
//     let content = fs.readFileSync(path.resolve(__dirname, '../dist/index.d.ts'), 'utf-8');
//     content = content.replace(/^\s*(private|protected)\s+\_.+;/g, '');
//     content = require('./copyright') + '\n' + content;
//     fs.writeFileSync(path.resolve(__dirname, '../dist/index.d.ts'), content, 'utf-8');
// })();

// replace __TSRPC_VERSION__from index.js/mjs
[
    path.resolve(__dirname, '../dist/index.js'),
    path.resolve(__dirname, '../dist/index.mjs')
].forEach(filepath => {
    let content = fs.readFileSync(filepath, 'utf-8');
    content = content.replace('__TSRPC_VERSION__', require('../package.json').version);;
    fs.writeFileSync(filepath, content, 'utf-8');
});

// mongodb-polyfill
fs.copyFileSync(path.resolve(__dirname, '../res/mongodb-polyfill.d.ts'), path.resolve(__dirname, '../dist/mongodb-polyfill.d.ts'));
let content = fs.readFileSync(path.resolve(__dirname, '../dist/index.d.ts'), 'utf-8');
content = content.replace(`/// <reference types="node" />`, `/// <reference types="node" />\n/// <reference path="mongodb-polyfill.d.ts" />`)
fs.writeFileSync(path.resolve(__dirname, '../dist/index.d.ts'), content, 'utf-8');