import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/buffer\.indexOf\('\n'\)/g, "buffer.indexOf('\\n')");
fs.writeFileSync('server.ts', content);
