const fs = require('fs');
const path = require('path');

let content = fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8');
let json = JSON.parse(content);

delete json.scripts;
delete json.devDependencies;

fs.writeFileSync(path.resolve(__dirname, '../dist/package.json'), JSON.stringify(json, null, 2), 'utf-8')