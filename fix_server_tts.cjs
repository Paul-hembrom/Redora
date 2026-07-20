const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const ttsRouteOld = `app.post('/api/tts/cartesia', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });

    const apiKey = process.env.CARTESIA_API_KEY || process.env.VITE_CARTESIA_API_KEY;
    if (!apiKey) {
      console.error('CARTESIA_API_KEY is not set');
      return res.status(500).json({ error: 'Cartesia API key missing' });
    }

    const chunks = chunkDocumentText(text);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(JSON.stringify({ totalChunks: chunks.length }) + '\\n');

    const cartesia = new Cartesia({ apiKey });
    const ws = await cartesia.tts.websocket();
    ws.on('error', (err) => {
      console.error('Cartesia WebSocket error:', err);
    });

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        const context = ws.context({
            model_id: 'sonic-3.5',
            voice: { mode: 'id', id: 'a0e99841-438c-4a64-b679-ae501e7d6091' },
            output_format: { container: 'raw', encoding: 'pcm_f32le', sample_rate: 44100 },
            add_timestamps: true
        });

        const cleanChunk = normalizeTextForCartesia(chunk.text);
        let spokenText = cleanChunk;
        if (/\\\\(?:int|sum|begin|sin|cos|lim|frac|sqrt|tan|prod|theta|alpha|beta|gamma|omega|sigma)|\\\\{|\\\\}/i.test(chunk.text)) {
            spokenText = await normalizeTextWithLLM(cleanChunk);
        }
        await context.send({ transcript: spokenText });

        let audioBuffers: Buffer[] = [];
        let timestamps: any[] = [];

        for await (const message of context.receive()) {
            const msg = message as any;
            if (msg.audio) {
                const buf = Buffer.from(msg.audio, 'base64');
                audioBuffers.push(buf);
            }
            if (msg.word_timestamps) {
                for (let k = 0; k < msg.word_timestamps.words.length; k++) {
                    timestamps.push({
                        word: msg.word_timestamps.words[k],
                        start: msg.word_timestamps.start[k],
                        end: msg.word_timestamps.end[k]
                    });
                }
            }
        }

        const rawAudio = Buffer.concat(audioBuffers);
        const header = createFloat32WavHeader(rawAudio.length, 44100);
        const finalBuffer = Buffer.concat([header, rawAudio]);
        const audioUrl = 'data:audio/wav;base64,' + finalBuffer.toString('base64');

        res.write(JSON.stringify({
            index: i,
            domIndex: chunk.domIndex,
            text: chunk.text,
            audioUrl: audioUrl,
            timestamps: timestamps
        }) + '\\n');
    }

    ws.close();
    res.end();
  } catch (err: any) {
    console.error("Cartesia TTS error:", err);
    res.end();
  }
});`;

const ttsRouteNew = `app.post('/api/tts/cartesia', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });

    const apiKey = process.env.CARTESIA_API_KEY || process.env.VITE_CARTESIA_API_KEY;
    if (!apiKey) {
      console.error('CARTESIA_API_KEY is not set');
      return res.status(500).json({ error: 'Cartesia API key missing' });
    }

    const chunks = chunkDocumentText(text);

    const cartesia = new Cartesia({ apiKey });
    let ws;
    try {
      ws = await cartesia.tts.websocket();
      ws.on('error', (err) => {
        console.error('Cartesia WebSocket error:', err);
      });
    } catch (wsErr) {
      console.error('Failed to open Cartesia WebSocket:', wsErr);
      return res.status(500).json({ error: 'Failed to connect to Cartesia' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(JSON.stringify({ totalChunks: chunks.length }) + '\\n');

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
            const context = ws.context({
                model_id: 'sonic-3.5',
                voice: { mode: 'id', id: 'a0e99841-438c-4a64-b679-ae501e7d6091' },
                output_format: { container: 'raw', encoding: 'pcm_f32le', sample_rate: 44100 },
                add_timestamps: true
            });

            const cleanChunk = normalizeTextForCartesia(chunk.text);
            let spokenText = cleanChunk;
            if (/\\\\(?:int|sum|begin|sin|cos|lim|frac|sqrt|tan|prod|theta|alpha|beta|gamma|omega|sigma)|\\\\{|\\\\}/i.test(chunk.text)) {
                spokenText = await normalizeTextWithLLM(cleanChunk);
            }
            await context.send({ transcript: spokenText });

            let audioBuffers = [];
            let timestamps = [];

            for await (const message of context.receive()) {
                const msg = message;
                if (msg.audio) {
                    const buf = Buffer.from(msg.audio, 'base64');
                    audioBuffers.push(buf);
                }
                if (msg.word_timestamps) {
                    for (let k = 0; k < msg.word_timestamps.words.length; k++) {
                        timestamps.push({
                            word: msg.word_timestamps.words[k],
                            start: msg.word_timestamps.start[k],
                            end: msg.word_timestamps.end[k]
                        });
                    }
                }
            }
            
            if (audioBuffers.length > 0) {
              const rawAudio = Buffer.concat(audioBuffers);
              const header = createFloat32WavHeader(rawAudio.length, 44100);
              const finalBuffer = Buffer.concat([header, rawAudio]);
              const audioUrl = 'data:audio/wav;base64,' + finalBuffer.toString('base64');

              res.write(JSON.stringify({
                  index: i,
                  domIndex: chunk.domIndex,
                  text: chunk.text,
                  audioUrl: audioUrl,
                  timestamps: timestamps
              }) + '\\n');
            }
        } catch (chunkErr) {
            console.error(\`Error processing chunk \${i}:\`, chunkErr);
        }
    }

    try { ws.close(); } catch (e) {}
    res.end();
  } catch (err: any) {
    console.error("Cartesia TTS error:", err);
    res.end();
  }
});`;

// Try to replace exactly.
if (code.includes(ttsRouteOld)) {
    code = code.replace(ttsRouteOld, ttsRouteNew);
    fs.writeFileSync('server.ts', code);
    console.log("Fixed server.ts exact");
} else {
    console.log("Exact string not found in server.ts");
}
