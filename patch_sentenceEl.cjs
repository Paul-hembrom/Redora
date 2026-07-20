const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldCheck = `        let sentenceEl = scopeRoot.querySelector(\`[id="\${idPrefix}\${domIndex}"]\`) as HTMLElement | null;
        if (!sentenceEl && idPrefix.startsWith("tts-explanation-")) {
            sentenceEl = scopeRoot.querySelector(\`[id="\${idPrefix}0"]\`) as HTMLElement | null;
        }`;

const newCheck = `        let sentenceEl = scopeRoot.querySelector(\`[id="\${idPrefix}\${domIndex}"]\`) as HTMLElement | null;
        if (!sentenceEl && idPrefix.startsWith("tts-explanation-")) {
            sentenceEl = scopeRoot.querySelector(\`[id="\${idPrefix}0"]\`) as HTMLElement | null;
        }
        if (!sentenceEl) {
            sentenceEl = document.getElementById(\`tts-sentence-\${i}\`) as HTMLElement | null;
        }`;

code = code.replace(oldCheck, newCheck);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Patched sentenceEl fallback");
