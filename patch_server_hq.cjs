const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `    const { text, highQuality } = req.body;`;
const replacement1 = `    const { text, hq } = req.body;`;

const target2 = `            // Fallback to ElevenLabs
            const voiceId = 'JwEIvMzFlLwrArLvqeM5'; // Katrina R
            const modelId = highQuality ? 'eleven_multilingual_v2' : 'eleven_flash_v2_5';
            console.log(\`[TTS] Using ElevenLabs model: \${modelId} (\${highQuality ? 'HQ' : 'Standard'})\`);`;
const replacement2 = `            // Fallback to ElevenLabs
            const voiceId = 'JwEIvMzFlLwrArLvqeM5'; // Katrina R
            const modelId = hq ? 'eleven_multilingual_v2' : 'eleven_flash_v2_5';
            console.log(\`[TTS] ElevenLabs model: \${modelId} (\${hq ? 'HQ' : 'Standard'})\`);`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);

fs.writeFileSync('server.ts', code);
