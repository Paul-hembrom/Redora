const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// Fix explanation fallback check to use startsWith
code = code.replace(
    /if \(\!sentenceEl && idPrefix === "tts-explanation-"\) \{/g,
    `if (!sentenceEl && idPrefix.startsWith("tts-explanation-")) {`
);

code = code.replace(
    /sentenceEl = scopeRoot\.querySelector\(\`\[id="tts-explanation-0"\]\`\) as HTMLElement \| null;/g,
    `sentenceEl = scopeRoot.querySelector(\`[id="\${idPrefix}0"]\`) as HTMLElement | null;`
);

code = code.replace(
    /if \(expectedElements === 0 && idPrefix !== "tts-explanation-"\) \{/g,
    `if (expectedElements === 0 && !idPrefix.startsWith("tts-explanation-")) {`
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("fixed ReadAloudButton.tsx");
