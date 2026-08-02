const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

const regexStr = "const wordEscaped = " + "word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');";
const aliasStr = "const aliasPattern = aliases.map(a => a.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')).join('|');";
const b1Str = "if (/^\\w/.test(word)) regexPattern = `\\\\b${regexPattern}`;";
const b2Str = "if (/\\w$/.test(word)) regexPattern = `${regexPattern}\\\\b`;";

const startTag = "if (!word) continue;";
const endTag = "let matchIdx = -1;";

const startIndex = code.indexOf(startTag);
const endIndex = code.indexOf(endTag);

const newBlock = startTag + "\n" +
"                " + regexStr + "\n" +
"                let regexPattern = wordEscaped;\n" +
"                const aliases = MATH_ALIASES[word.toLowerCase()];\n" +
"                if (aliases) {\n" +
"                    " + aliasStr + "\n" +
"                    regexPattern = `(${regexPattern}|${aliasPattern})`;\n" +
"                } else {\n" +
"                    " + b1Str + "\n" +
"                    " + b2Str + "\n" +
"                }\n\n                ";

code = code.substring(0, startIndex) + newBlock + code.substring(endIndex);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
