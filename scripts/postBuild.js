const fs = require('fs');
const path = require('path');

let content = fs.readFileSync(path.resolve(__dirname, '../dist/index.d.ts'), 'utf-8');
content = content.replace(/\s+(private|protected).+;/g, '');
content = require('./copyright') + '\n' + content;
content.replace('__TSRPC_VERSION__', require('../package.json').version);
fs.writeFileSync(path.resolve(__dirname, '../dist/index.d.ts'), content, 'utf-8');