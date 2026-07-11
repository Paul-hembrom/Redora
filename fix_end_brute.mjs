import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace(/\*\/[\n\s\}]*$/, '*/\n});\n}\n}\n}\n');
fs.writeFileSync('server.ts', content);
