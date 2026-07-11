import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');
// remove the last */
content = content.replace(/\*\/[\n\s]*$/, '');
// try adding }
fs.writeFileSync('server.ts', content + "\n}");
