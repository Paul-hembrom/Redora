const fs = require('fs');
let code = fs.readFileSync('src/components/MarkdownComponents.tsx', 'utf8');

code = code.replace(
    /export const markdownComponents: Components = \{/,
    `export const markdownComponents: Components = {
  // We use a counter or random string for unique explanation IDs
`
);

code = code.replace(
    /id="tts-explanation-0"/g,
    `id={\`tts-explanation-\${Math.random().toString(36).slice(2, 9)}-0\`}`
);

// Wait, I can't use Math.random() directly inside render easily if it's passed to ReadAloudButton too, unless I store it!
