const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const ttsRouteOld = `    const cartesia = new Cartesia({ apiKey });
    let ws;
    try {
      ws = await cartesia.tts.websocket();
      if (ws.source) { ws.source.on('error', (err) => console.error('Cartesia WS error:', err)); }
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
    res.end();`;

const ttsRouteNew = `    const cartesia = new Cartesia({ apiKey });
    let ws;
    try {
      ws = await cartesia.tts.websocket();
      if (ws.source) { 
        ws.source.on('error', (err) => {
          console.error('Cartesia WebSocket source error:', err);
        }); 
      }
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

    try {
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
      }
    } catch (wsLoopErr) {
      console.error('Cartesia chunk streaming error:', wsLoopErr);
    } finally {
      try { ws.close(); } catch (e) {}
      res.end();
    }`;

if (code.includes(ttsRouteOld)) {
    code = code.replace(ttsRouteOld, ttsRouteNew);
    fs.writeFileSync('server.ts', code);
    console.log("Fixed server.ts exact");
} else {
    console.log("Exact string not found in server.ts");
}
