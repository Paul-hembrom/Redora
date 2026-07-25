const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldStr = `      mappedTimestamps = speakableWords.map((word) => {
        const wordDuration = (word.length / totalChars) * playbackDuration;`;

const newStr = `      mappedTimestamps = speakableWords.map((word) => {
        const wordDuration = (word.length / totalChars) * rawDuration;`;

content = content.replace(oldStr, newStr);

const oldStr2 = `      const avgDuration = playbackDuration / words.length;`;
const newStr2 = `      const avgDuration = rawDuration / words.length;`;

content = content.replace(oldStr2, newStr2);

fs.writeFileSync('server.ts', content);
console.log("Patched server.ts successfully");
