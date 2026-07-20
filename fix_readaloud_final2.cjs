const fs = require('fs');

// 1. Fix ChatArea.tsx
let chatCode = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
chatCode = chatCode.replace(
    /<div id=\{\`tts-summary-\$\{idx\}\`\}>/g,
    `<div id={\`tts-summary-\${chapter.id}-\${idx}\`}>`
);
chatCode = chatCode.replace(
    /<div id=\{\`tts-chapter-\$\{idx\}\`\}>/g,
    `<div id={\`tts-chapter-\${chapter.id}-\${idx}\`}>`
);
fs.writeFileSync('src/components/ChatArea.tsx', chatCode);


// 2. Fix ReadAloudButton.tsx
let raCode = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// The user asked to add id="tts-word-{sentenceIdx}-{wordIdx}"
// We can just add span.id = `tts-word-${i}-${m.tsIndex}`; where span is created
raCode = raCode.replace(
    /span\.className = 'tts-word transition-colors duration-100 ease-linear rounded';/,
    `span.className = 'tts-word transition-colors duration-100 ease-linear rounded';
                    span.id = \`tts-word-\${i}-\${m.tsIndex}\`;`
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', raCode);
console.log("Fixed ReadAloudButton and ChatArea");
