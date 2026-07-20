const fs = require('fs');
const lines = fs.readFileSync('server.ts', 'utf8').split('\n');
for (let i = 1974; i <= 1990; i++) {
    lines[i] = lines[i].replace(/message\.audio/g, 'msg.audio').replace(/message\.word_timestamps/g, 'msg.word_timestamps');
}
fs.writeFileSync('server.ts', lines.join('\n'));
console.log("Patched server.ts lines");
