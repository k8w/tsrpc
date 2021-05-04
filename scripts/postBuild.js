const fs = require('fs');
const path = require('path');

// remove private / protected index.d.ts
(() => {
    let content = fs.readFileSync(path.resolve(__dirname, '../dist/index.d.ts'), 'utf-8');
    content = content.replace(/\s+(private|protected).+;/g, '');
    content = require('./copyright') + '\n' + content;
    fs.writeFileSync(path.resolve(__dirname, '../dist/index.d.ts'), content, 'utf-8');
})();

// replace __TSRPC_VERSION__from index.cjs/mjs
[
    path.resolve(__dirname, '../dist/index.cjs'),
    path.resolve(__dirname, '../dist/index.mjs')
].forEach(filepath => {
    let content = fs.readFileSync(filepath, 'utf-8');
    content = content.replace('__TSRPC_VERSION__', require('../package.json').version);;
    fs.writeFileSync(filepath, content, 'utf-8');
});