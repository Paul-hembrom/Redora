const fs = require('fs');

let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// 1. Fix expectedElements
code = code.replace(
    /const expectedElements = scopeRoot\.querySelectorAll\(\`\[id\^="\$\{idPrefix\}"\]\`\)\.length;\s*if \(expectedElements > 0 && totalChunks !== expectedElements\) \{\s*logWarning\([\s\S]*?disableSync = true;\s*\}/,
    `const expectedElements = scopeRoot.querySelectorAll(\`[id^="\${idPrefix}"]\`).length;
                  if (expectedElements === 0 && idPrefix !== "tts-explanation-") {
                    logWarning(\`No DOM elements found matching \${idPrefix}. Disabling sync.\`);
                    disableSync = true;
                  }`
);

// 2. Fix sentenceEl
code = code.replace(
    /const sentenceEl = scopeRoot\.querySelector\(\`\[id="\$\{idPrefix\}\$\{domIndex\}"\]\`\) as HTMLElement \| null;/,
    `let sentenceEl = scopeRoot.querySelector(\`[id="\${idPrefix}\${domIndex}"]\`) as HTMLElement | null;
        if (!sentenceEl && idPrefix === "tts-explanation-") {
            sentenceEl = scopeRoot.querySelector(\`[id="tts-explanation-0"]\`) as HTMLElement | null;
        }`
);

// 3. Fix guard
code = code.replace(
    /\/\/ Guard: Check if the text matches \([\s\S]*?if \(shouldHighlight && chunk\.timestamps && chunk\.timestamps\.length > 0 && sentenceEl\) \{/,
    `// Guard removed for markdown compatibility
        if (shouldHighlight && chunk.timestamps && chunk.timestamps.length > 0 && sentenceEl) {`
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Patched ReadAloudButton.tsx");
