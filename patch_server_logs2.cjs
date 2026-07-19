const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex1 = /    console.log\(\`\[TTS\] Request received. Text length: \$\{text.length\}, HighQuality: \$\{highQuality\}\`\);/;
const replacement1 = `    console.log(\`[TTS] Request received. Text length: \${text.length}, Voice ID: \${voiceId}, Streaming: true, HighQuality: \${highQuality}\`);`;
code = code.replace(regex1, replacement1);

const regex2 = /               const response = await fetchWithTimeout\(url, \{/;
const replacement2 = `               console.log(\`[TTS] Calling ElevenLabs API for chunk \${reqChunk.index}\`);
               const response = await fetchWithTimeout(url, {`;
code = code.replace(regex2, replacement2);

const regex3 = /               if \(!response.ok\) \{/;
const replacement3 = `               console.log(\`[TTS] ElevenLabs streaming API response status: \${response.status} for chunk \${reqChunk.index}\`);
               if (!response.ok) {`;
code = code.replace(regex3, replacement3);

const regex4 = /            if \(fallbackResponse.ok\) \{/;
const replacement4 = `            console.log(\`[TTS] ElevenLabs fallback API response status: \${fallbackResponse.status} for chunk \${reqChunk.index}\`);
            if (fallbackResponse.ok) {`;
code = code.replace(regex4, replacement4);

fs.writeFileSync('server.ts', code);
console.log('patched server logs 2');
