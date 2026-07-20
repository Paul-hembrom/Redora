const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

code = code.replace(
    /idPrefix=\{chapter.content \? "tts-chapter-" : "tts-summary-"\}/,
    'idPrefix={chapter.content ? `tts-chapter-${chapter.id}-` : `tts-summary-${chapter.id}-`}'
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Fixed ChatArea idPrefix");
