const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

code = code.replace(
  "const text = await callLLM(prompt, false, 0.3);",
  "const text = await callLLM(prompt, undefined, 0.3);"
);

fs.writeFileSync('src/lib/gemini.ts', code);
console.log("Fixed callLLM arguments");
