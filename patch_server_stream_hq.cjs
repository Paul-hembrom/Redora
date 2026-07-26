const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `    const { text, highQuality } = req.body;`;
const replacement1 = `    const { text, hq } = req.body;`;

const target2 = `    const modelId = highQuality ? 'eleven_multilingual_v2' : 'eleven_flash_v2_5';`;
const replacement2 = `    const modelId = hq ? 'eleven_multilingual_v2' : 'eleven_flash_v2_5';`;

const target3 = `HighQuality: \${highQuality}`;
const replacement3 = `HighQuality: \${hq}`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);
code = code.replace(target3, replacement3);

fs.writeFileSync('server.ts', code);
