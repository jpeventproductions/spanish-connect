const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const categories = ['connectors', 'patterns', 'present', 'past', 'future', 'everyday'];
const data = categories.flatMap(category => JSON.parse(fs.readFileSync(path.join(root, 'data', `${category}.json`), 'utf8')));
if (data.length !== 300 || new Set(data.map(p => p.id)).size !== 300) throw new Error('Expected 300 unique phrases.');
fs.writeFileSync(path.join(root,'phrases.js'), `// Generated from data/*.json by scripts/build-data.cjs.\nwindow.SPANISH_PHRASES = ${JSON.stringify(data,null,2)};\n`);
console.log(`Built ${data.length} phrases across ${categories.length} categories.`);
