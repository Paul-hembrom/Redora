const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');
code = code.replace(/import \* as pdfjsLib from 'pdfjs-dist';\n/, '');
code = code.replace(/const pdf = await pdfjsLib\.getDocument/g, "const pdfjsLib = await import('pdfjs-dist');\n  const pdf = await pdfjsLib.getDocument");
fs.writeFileSync('src/lib/gemini.ts', code);
