import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

// The lines look like:
// }) + '
// ');

// We need to replace:
// \n});\n
// or whatever it is with }) + '\\n');

content = content.replace(/\) \+ '\n'\);/g, ") + '\\n');");
fs.writeFileSync('server.ts', content);
