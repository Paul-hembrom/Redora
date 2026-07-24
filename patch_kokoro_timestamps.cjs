const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /\/\/ Check for empty audio \(< 200 bytes means audioUrl length < 266 approx\)[\s\S]*?if \(!kokoroResult\.audioUrl \|\| kokoroResult\.audioUrl\.length < 300\) \{\n                throw new Error\("Kokoro returned empty audio after retry"\);\n              \}\n            \}/g;

const replacement = `// Check for empty audio OR empty timestamps
            const hasValidAudio = kokoroResult.audioUrl && kokoroResult.audioUrl.length >= 300;
            const hasValidTimestamps = kokoroResult.timestamps && kokoroResult.timestamps.length > 0;

            if (!hasValidAudio || !hasValidTimestamps) {
              console.warn(
                \`[Kokoro] Chunk \${i} invalid - audio: \${!!hasValidAudio}, timestamps: \${kokoroResult.timestamps?.length || 0}, retrying...\`
              );
              await new Promise(resolve => setTimeout(resolve, 1000));
              kokoroResult = await synthesizeKokoroSpeech(spokenText);

              const retryAudio = kokoroResult.audioUrl && kokoroResult.audioUrl.length >= 300;
              const retryTimestamps = kokoroResult.timestamps && kokoroResult.timestamps.length > 0;

              if (!retryAudio || !retryTimestamps) {
                throw new Error("Kokoro returned empty audio or timestamps after retry");
              }
            }`;

code = code.replace(regex, replacement);
fs.writeFileSync('server.ts', code);
console.log("Patched Kokoro timestamps fallback");
