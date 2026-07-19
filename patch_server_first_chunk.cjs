const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldPrewarm = `      body: JSON.stringify({ text: " ", model_id: 'eleven_flash_v2_5' })`;
const newPrewarm = `      body: JSON.stringify({ text: ".", model_id: 'eleven_flash_v2_5' })`;
code = code.replace(oldPrewarm, newPrewarm);

const oldSplit = `        // Force the first sentence to be short
        if (domIndex === 0 && block.length > 80) {
            const match = block.match(/^(.{15,100}?[.,;:!?])\\s+(.+)$/s);
            if (match) {
                chunkRequests.push({ text: match[1], domIndex, index: chunkRequests.length });
                chunkRequests.push({ text: match[2], domIndex, index: chunkRequests.length });
                return;
            }
        }`;
const newSplit = `        // Force the first sentence to be short
        if (domIndex === 0 && block.length > 80) {
            let splitIndex = -1;
            const match = block.match(/^(.{15,100}?[.,;:!?])\\s/);
            if (match) {
                splitIndex = match[1].length;
            } else {
                const spaceMatch = block.match(/^(.{50,100}?)\\s/);
                if (spaceMatch) splitIndex = spaceMatch[1].length;
            }
            if (splitIndex > 0) {
                chunkRequests.push({ text: block.substring(0, splitIndex).trim(), domIndex, index: chunkRequests.length });
                chunkRequests.push({ text: block.substring(splitIndex).trim(), domIndex, index: chunkRequests.length });
                return;
            }
        }`;
code = code.replace(oldSplit, newSplit);

fs.writeFileSync('server.ts', code);
console.log('patched server');
