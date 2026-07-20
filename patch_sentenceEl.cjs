const fs = require('fs');
let btnCode = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldStr = `        const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
        const scopeRoot = getScopeRoot();
        const sentenceEl = scopeRoot.querySelector(\`[id="\${idPrefix}\${domIndex}"]\`) as HTMLElement | null;`;

const newStr = `        const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
        const scopeRoot = getScopeRoot();
        let sentenceEl = scopeRoot.querySelector(\`[id="\${idPrefix}\${domIndex}"]\`) as HTMLElement | null;
        if (!sentenceEl && idPrefix === "tts-explanation-") {
            sentenceEl = scopeRoot.querySelector(\`[id="tts-explanation-0"]\`) as HTMLElement | null;
        }`;

btnCode = btnCode.replace(oldStr, newStr);
fs.writeFileSync('src/components/ReadAloudButton.tsx', btnCode);
console.log('patched ReadAloudButton.tsx sentenceEl');
