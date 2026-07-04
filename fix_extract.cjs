const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const regex = /STRICT RULES:\n1\. DO NOT summarize, change, or omit ANY text\. Copy the text verbatim\./;
const replacement = `STRICT RULES:\n1. CRITICAL: DO NOT summarize, omit, or change ANY text. Every paragraph, sentence, and word from the original must appear EXACTLY ONCE in the output. Copy the text verbatim into the appropriate topic's "content" field.`;
code = code.replace(regex, replacement);

const regex2 = /131072, 0/;
const replacement2 = `384000, 0`;
code = code.replace(regex2, replacement2);

fs.writeFileSync('src/lib/gemini.ts', code);
