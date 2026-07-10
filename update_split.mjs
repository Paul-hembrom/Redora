import fs from 'fs';

let serverTs = fs.readFileSync('server.ts', 'utf-8');

const regexFix = `
function splitIntoSentences(text) {
  // Split on . ! ? followed by whitespace, keeping the punctuation
  const regex = /([^.!?]+[.!?]+)\\s*/g;
  let sentences = [];
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match[1].trim()) {
      sentences.push(match[1].trim());
    }
    lastIndex = regex.lastIndex;
  }
  // Fallback for remaining text without punctuation
  const remaining = text.substring(lastIndex).trim();
  if (remaining) {
    sentences.push(remaining);
  }
  return sentences;
}
`;

serverTs = serverTs.replace(/function splitIntoSentences\(text\) \{[\s\S]*?return sentences;\n\}/, regexFix.trim());

fs.writeFileSync('server.ts', serverTs);
console.log('done');
