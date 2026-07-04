const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');
code = code.replace(/async function getGenAI\(\)/, 'export async function getGenAI()');
fs.writeFileSync('src/lib/gemini.ts', code);
