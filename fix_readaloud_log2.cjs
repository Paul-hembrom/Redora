const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const target2 = `             if (data.index !== undefined) {
                chunksMapRef.current.set(data.index, data);`;

const newCode2 = `             if (data.index !== undefined) {
                if (data.timestamps && data.timestamps.length > 0) {
                    console.log(\`[Frontend] Chunk \${data.index} – first timestamp:\`, JSON.stringify(data.timestamps[0]), 'last timestamp:', JSON.stringify(data.timestamps[data.timestamps.length - 1]));
                }
                chunksMapRef.current.set(data.index, data);`;

content = content.replace(target2, newCode2);
fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Fixed second log");
