const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');
code = code.replace("if (/^\\\\w/.test(word)) regexPattern = `\\\\b${regexPattern}`;", "if (/^\\w/.test(word)) regexPattern = `\\b${regexPattern}`;");
code = code.replace("if (/\\\\w$/.test(word)) regexPattern = `${regexPattern}\\\\b`;", "if (/\\w$/.test(word)) regexPattern = `${regexPattern}\\b`;");
code = code.replace("const wordEscaped = word.replace(/[.*+?^${}()|[\\\\]\\\\\\\\]/g, '\\\\$&');", "const wordEscaped = word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');");
code = code.replace("const aliasPattern = aliases.map(a => a.replace(/[.*+?^${}()|[\\\\]\\\\\\\\]/g, '\\\\$&')).join('|');", "const aliasPattern = aliases.map(a => a.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')).join('|');");
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
