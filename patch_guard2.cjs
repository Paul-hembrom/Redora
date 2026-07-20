const fs = require('fs');
let btnCode = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regexGuard = /\/\/ Guard: Check if the text matches[\s\S]*?if \(shouldHighlight && chunk\.timestamps && chunk\.timestamps\.length > 0 && sentenceEl\)/;
const replacementGuard = `        // Guard removed for markdown compatibility
        if (shouldHighlight && chunk.timestamps && chunk.timestamps.length > 0 && sentenceEl)`;

btnCode = btnCode.replace(regexGuard, replacementGuard);
fs.writeFileSync('src/components/ReadAloudButton.tsx', btnCode);
console.log('patched ReadAloudButton.tsx guard');
