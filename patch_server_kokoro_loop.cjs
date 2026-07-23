const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /const cleanChunk = normalizeTextForCartesia\(chunk\.text\);[\s\S]*?const kokoroResult = await synthesizeKokoroSpeech\(spokenText\);/g;

const replacement = `const cleanChunk = normalizeTextForCartesia(chunk.text);
          let spokenText = await normalizeTextWithLLM(cleanChunk);

          try {
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 40)); // 40ms delay
            }

            // Try Kokoro first
            let kokoroResult = await synthesizeKokoroSpeech(spokenText);
            
            // Check for empty audio (< 200 bytes means audioUrl length < 266 approx)
            if (!kokoroResult.audioUrl || kokoroResult.audioUrl.length < 300) {
              console.warn(\`[Kokoro] Chunk \${i} returned empty audio (\${kokoroResult.audioUrl?.length} chars), retrying...\`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // wait a bit before retry
              kokoroResult = await synthesizeKokoroSpeech(spokenText);
              if (!kokoroResult.audioUrl || kokoroResult.audioUrl.length < 300) {
                throw new Error("Kokoro returned empty audio after retry");
              }
            }`;

code = code.replace(regex, replacement);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts Kokoro loop");
