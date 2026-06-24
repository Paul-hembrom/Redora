import fs from 'fs';
const content = fs.readFileSync('src/lib/gemini.ts', 'utf8');
const fixedContent = content.replace(/\\n/g, '\n');
fs.writeFileSync('src/lib/gemini.ts', fixedContent);
console.log('Fixed newlines');
