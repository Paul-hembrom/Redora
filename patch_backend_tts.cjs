const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Add pre-warm endpoint right before /api/tts/elevenlabs
const prewarmStr = `
app.post('/api/tts/elevenlabs/prewarm', async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(200).json({ status: 'skip' });
    const voiceId = 'JwEIvMzFlLwrArLvqeM5';
    fetch(\`https://api.elevenlabs.io/v1/text-to-speech/\${voiceId}?output_format=mp3_22050_32\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({ text: " ", model_id: 'eleven_flash_v2_5' })
    }).catch(() => {});
    res.json({ status: 'ok' });
  } catch(e) {
    res.json({ status: 'error' });
  }
});

app.post('/api/tts/elevenlabs',`;

code = code.replace("app.post('/api/tts/elevenlabs',", prewarmStr);

// 2. Rewrite /api/tts/elevenlabs logic
const oldLogicRegex = /    const rawBlocks = text\.split\(\/\\n\\n\+\/\)\.map\(s => s\.trim\(\)\)\.filter\(Boolean\);[\s\S]*?res\.end\(\);\n  \} catch \(err: any\) \{/m;

const newLogic = `    const rawBlocks = text.split(/\\n\\n+/).map(s => s.trim()).filter(Boolean);
    
    const chunkRequests: { text: string, domIndex: number, index: number }[] = [];
    rawBlocks.forEach((block, domIndex) => {
        // Force the first sentence to be short
        if (domIndex === 0 && block.length > 80) {
            const match = block.match(/^(.{15,100}?[.,;:!?])\\s+(.+)$/s);
            if (match) {
                chunkRequests.push({ text: match[1], domIndex, index: chunkRequests.length });
                chunkRequests.push({ text: match[2], domIndex, index: chunkRequests.length });
                return;
            }
        }
        chunkRequests.push({ text: block, domIndex, index: chunkRequests.length });
    });

    const ttsLimiter = createConcurrencyLimit(3);
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    res.write(JSON.stringify({ totalChunks: chunkRequests.length }) + '\\n');

    const fetchWithTimeout = async (url: string, options: any, timeoutMs: number) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    };

    const chunks = await Promise.all(chunkRequests.map(async (reqChunk) => {
      return ttsLimiter(async () => {
        let retries = 0;
        
        while (retries <= 1) {
           try {
               const response = await fetchWithTimeout(url, {
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
               }, 2000); // 2 second timeout per user request
               
               if (!response.ok) {
                 retries++;
                 continue;
               }
               
               const audioBuffer = await response.arrayBuffer();
               if (audioBuffer.byteLength < 500) {
                 retries++;
                 continue;
               }
               
               const base64 = Buffer.from(audioBuffer).toString('base64');
               let timestamps = [];
               try {
                 const fd = new FormData();
                 fd.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3');
                 fd.append('model_id', 'scribe_v1');
                 fd.append('timestamps', 'true');
                 
                 const scribeRes = await fetchWithTimeout('https://api.elevenlabs.io/v1/speech-to-text', {
                   method: 'POST',
                   headers: { 'xi-api-key': apiKey },
                   body: fd
                 }, 3000); // slightly longer for scribe
                 
                 if (scribeRes.ok) {
                   const scribeData = await scribeRes.json();
                   if (scribeData.words && Array.isArray(scribeData.words)) {
                     timestamps = scribeData.words.map((w: any) => ({
                       word: w.text || w.word,
                       start: w.start,
                       end: w.end
                     }));
                   }
                 }
               } catch (scribeErr) {
                 console.error("Scribe error:", scribeErr);
               }
               
               const result = { index: reqChunk.index, domIndex: reqChunk.domIndex, text: reqChunk.text, audioUrl: \`data:audio/mpeg;base64,\${base64}\`, timestamps };
               res.write(JSON.stringify(result) + '\\n');
               return result;
           } catch(e) {
               retries++;
           }
        }
        const errResult = { index: reqChunk.index, domIndex: reqChunk.domIndex, text: reqChunk.text, audioUrl: null };
        res.write(JSON.stringify(errResult) + '\\n');
        return errResult;
      });
    }));

    res.end();
  } catch (err: any) {`;

code = code.replace(oldLogicRegex, newLogic);
fs.writeFileSync('server.ts', code);
console.log('patched backend TTS');
