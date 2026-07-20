const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');
code = code.replace(
    /const expectedElements = scopeRoot\.querySelectorAll\(\`\\\[id\^="\$\{idPrefix\}"\\\]\`\)\.length;/,
    `const expectedElements = scopeRoot.querySelectorAll(\`[id^="\${idPrefix}"]\`).length;
    console.log("Checking sync elements", {idPrefix, expectedElements, root: scopeRoot === document});`
);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
