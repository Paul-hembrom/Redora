const fs = require('fs');
let code = fs.readFileSync('src/components/MarkdownComponents.tsx', 'utf8');

code = code.replace(
    /id="tts-explanation-0"/g,
    `id={\`tts-explanation-\${uniqueId}-0\`}`
);

code = code.replace(
    /<ReadAloudButton\s+text=\{explanation\}/g,
    `<ReadAloudButton idPrefix={\`tts-explanation-\${uniqueId}-\`} text={explanation}`
);

fs.writeFileSync('src/components/MarkdownComponents.tsx', code);
console.log("fixed MarkdownComponents ID");
