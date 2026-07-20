const fs = require('fs');

// 1. Fix server.ts fs import & log removal
let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(/fs\.appendFileSync\([\s\S]*?\n/, '');
fs.writeFileSync('server.ts', serverCode);

// 2. Fix ChatArea.tsx index usage
let chatCode = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
chatCode = chatCode.replace(/id=\{\`tts-summary-\$\{index\}-\$\{idx\}\`\}/g, "id={`tts-summary-${chapter.id}-${idx}`}");
chatCode = chatCode.replace(/id=\{\`tts-chapter-\$\{index\}-\$\{idx\}\`\}/g, "id={`tts-chapter-${chapter.id}-${idx}`}");
chatCode = chatCode.replace(/idPrefix=\{chapter\.content \? \`tts-chapter-\$\{index\}-\` : \`tts-summary-\$\{index\}-\`\}/g, "idPrefix={chapter.content ? `tts-chapter-${chapter.id}-` : `tts-summary-${chapter.id}-`}");
fs.writeFileSync('src/components/ChatArea.tsx', chatCode);

console.log("Lint errors fixed");
