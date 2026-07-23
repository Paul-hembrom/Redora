const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regex = /const audio = new Audio\(chunk\.audioUrl\);/;
const replaceWith = `
        if (i === 0) {
            console.log('[ReadAloud] Chunk 0 timestamps received:', chunk.timestamps?.length);
            if (chunk.timestamps?.length > 0) {
                console.log('[ReadAloud] First timestamp in chunk 0:', JSON.stringify(chunk.timestamps[0]));
            } else {
                console.warn('[ReadAloud] Missing or empty timestamps in chunk 0!');
            }
        }
        
        const audio = new Audio(chunk.audioUrl);`;

code = code.replace(regex, replaceWith);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Patched ReadAloudButton with log");
