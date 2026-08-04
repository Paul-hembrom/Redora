const fs = require('fs');
let content = fs.readFileSync('src/lib/gemini.ts', 'utf-8');

content = content.replace(/384000/g, '8192');

fs.writeFileSync('src/lib/gemini.ts', content);
console.log("Fixed maxTokens");
