const fs = require('fs');
let content = fs.readFileSync('src/lib/gemini.ts', 'utf8');

content = content.replace('const text = await callLLM(prompt, undefined, 0.3);', 'const text = await callLLM(prompt, undefined, undefined, undefined, 0.3);');

fs.writeFileSync('src/lib/gemini.ts', content);
console.log("Patched successfully");
