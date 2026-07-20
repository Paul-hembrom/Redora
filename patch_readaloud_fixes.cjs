const fs = require('fs');

// 1. Fix MarkdownComponents.tsx
let mdCode = fs.readFileSync('src/components/MarkdownComponents.tsx', 'utf8');
mdCode = mdCode.replace(
    /className="text-white\/80 text-sm leading-relaxed pr-10">/,
    'id="tts-explanation-0" className="text-white/80 text-sm leading-relaxed pr-10">'
);
mdCode = mdCode.replace(
    /<ReadAloudButton \n                       text=\{explanation\}\n                      className="/,
    '<ReadAloudButton \n                       text={explanation}\n                       idPrefix="tts-explanation-"\n                      className="'
);
fs.writeFileSync('src/components/MarkdownComponents.tsx', mdCode);
console.log('patched MarkdownComponents.tsx');

// 2. Fix ReadAloudButton.tsx
let btnCode = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// Fix expectedElements logic to NOT disable sync on mismatch
const regexTotalChunks = /const expectedElements = scopeRoot\.querySelectorAll\(\`\[id\^="\\\$\\{idPrefix\\}"\]\`\)\.length;\n\s+if \(expectedElements > 0 && totalChunks !== expectedElements\) \{\n\s+logWarning\(\`Mismatch: expected \\\$\\{expectedElements\\} DOM elements but got \\\$\\{totalChunks\\} audio chunks\. Falling back to whole-text playback \\(disabling sync\\)\.\`\);\n\s+disableSync = true;\n\s+\}/;
const replacementTotalChunks = `                  const expectedElements = scopeRoot.querySelectorAll(\`[id^="\${idPrefix}"]\`).length;                  if (expectedElements === 0 && idPrefix !== "tts-explanation-") {                    logWarning(\`No DOM elements found matching \${idPrefix}. Disabling sync.\`);                    disableSync = true;                  }`;
btnCode = btnCode.replace(regexTotalChunks, replacementTotalChunks);

fs.writeFileSync('src/components/ReadAloudButton.tsx', btnCode);
console.log('patched ReadAloudButton.tsx');
