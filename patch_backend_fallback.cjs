const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldLogicRegex = /               if \(!finalAudioBase64\) \{\n                   retries\+\+;\n                   continue;\n               }/m;

const newLogic = `               if (!finalAudioBase64) {
                   retries++;
                   continue;
               }`;

// Let's replace the whole inner loop to include the non-streaming fallback.
// Actually, it's easier to just modify the return logic if the streaming loop exhausts retries.
const oldReturn = `        const errResult = { index: reqChunk.index, domIndex: reqChunk.domIndex, text: reqChunk.text, audioUrl: null };
        res.write(JSON.stringify(errResult) + '\\n');
        return errResult;
      });`;

const newReturn = `        // Fallback to non-streaming if stream failed
        try {
            const fallbackUrl = \`https://api.elevenlabs.io/v1/text-to-speech/\${voiceId}?output_format=mp3_44100_128\`;
            const fallbackResponse = await fetchWithTimeout(fallbackUrl, {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json',
                   'xi-api-key': apiKey,
                 },
                 body: JSON.stringify({
                   text: reqChunk.text,
                   model_id: modelId,
                   voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                 }),
            }, 3000);
            
            if (fallbackResponse.ok) {
                const fbBuffer = await fallbackResponse.arrayBuffer();
                if (fbBuffer.byteLength >= 500) {
                    const fbBase64 = Buffer.from(fbBuffer).toString('base64');
                    const fbResult = { index: reqChunk.index, domIndex: reqChunk.domIndex, text: reqChunk.text, audioUrl: \`data:audio/mpeg;base64,\${fbBase64}\`, timestamps: [] };
                    res.write(JSON.stringify(fbResult) + '\\n');
                    return fbResult;
                }
            }
        } catch(e) {}
        
        const errResult = { index: reqChunk.index, domIndex: reqChunk.domIndex, text: reqChunk.text, audioUrl: null };
        res.write(JSON.stringify(errResult) + '\\n');
        return errResult;
      });`;

code = code.replace(oldReturn, newReturn);
fs.writeFileSync('server.ts', code);
console.log('patched backend fallback');
