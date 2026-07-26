const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const target = `                    const wordSpan = document.getElementById(spanId);
                const activeWordText = wordSpan ? wordSpan.innerText : 'unknown';`;

const replacement = `                const activeWordText = span ? span.innerText : 'unknown';`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
