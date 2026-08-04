const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const target = "const endpoint = `${SPACE_URL}/process`;";
const replace = "const endpoint = '/api/documents/process';";

code = code.replace(target, replace);
fs.writeFileSync('src/lib/documentProcessor.ts', code);
