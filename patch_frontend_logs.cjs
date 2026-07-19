const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regex1 = /                  if \(totalChunks === 0\) \{/g;
const replacement1 = `                  logInfo(\`Received totalChunks: \${totalChunks}\`);
                  if (totalChunks === 0) {`;
code = code.replace(regex1, replacement1);

const regex2 = /                  if \(i === data.index && !isPlayingNext\) \{/g;
const replacement2 = `                  const isValid = data.audioUrl && data.audioUrl.startsWith('data:audio/');
                  logInfo(\`Received chunk \${data.index}. Audio URL valid: \${!!isValid}\`);
                  if (i === data.index && !isPlayingNext) {`;
code = code.replace(regex2, replacement2);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched frontend chunk logs');
