const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Fix summary ID
code = code.replace(
    /id=\{\`tts-summary-\$\{idx\}\`\}/g,
    `id={\`tts-summary-\${index}-\${idx}\`}`
);

// Fix chapter ID
code = code.replace(
    /id=\{\`tts-chapter-\$\{idx\}\`\}/g,
    `id={\`tts-chapter-\${index}-\${idx}\`}`
);

// Fix ReadAloudButton idPrefix
code = code.replace(
    /idPrefix=\{chapter\.content \? "tts-chapter-" : "tts-summary-"\}/g,
    `idPrefix={chapter.content ? \`tts-chapter-\${index}-\` : \`tts-summary-\${index}-\`}`
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("patched ChatArea.tsx");
