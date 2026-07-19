const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `const base64 = Buffer.from(audioBuffer).toString('base64');
           return { index, text: sentence, audioUrl: \`data:audio/mpeg;base64,\${base64}\` };`;

const replacementStr = `const base64 = Buffer.from(audioBuffer).toString('base64');
           let timestamps = [];
           try {
             const fd = new FormData();
             fd.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3');
             fd.append('model_id', 'scribe_v1');
             // ElevenLabs says to use timestamps_granularity in some docs, but user prompt says "timestamps: true"
             // Adding both just in case, or we'll stick to what the user said
             fd.append('timestamps', 'true');
             
             const scribeRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
               method: 'POST',
               headers: { 'xi-api-key': apiKey },
               body: fd
             });
             if (scribeRes.ok) {
               const scribeData = await scribeRes.json();
               if (scribeData.words && Array.isArray(scribeData.words)) {
                 timestamps = scribeData.words.map((w) => ({
                   word: w.text || w.word,
                   start: w.start,
                   end: w.end
                 }));
               }
             } else {
               console.error("Scribe API failed:", scribeRes.status, await scribeRes.text());
             }
           } catch (scribeErr) {
             console.error("Scribe API fetch error:", scribeErr);
           }
           return { index, text: sentence, audioUrl: \`data:audio/mpeg;base64,\${base64}\`, timestamps };`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('server.ts', code);
console.log('patched');
