const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStreamLog = `    console.log(\`[TTS] Request received. Text length: \${text.length}, Voice ID: \${voiceId}, Streaming: true, HighQuality: \${hq}\`);`;
const replacementStreamLog = `    console.log(hq ? '[TTS] ElevenLabs model: eleven_multilingual_v2 (HQ)' : '[TTS] ElevenLabs model: eleven_flash_v2_5 (Standard)');`;

code = code.replace(targetStreamLog, replacementStreamLog);

fs.writeFileSync('server.ts', code);
