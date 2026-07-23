const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const kokoroHelper = `
async function synthesizeKokoroSpeech(text: string, voice = "bf_emma") {
  const response = await fetch("https://paulhemb-redora.hf.space/v1/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text, voice, speed: 1.0 })
  });

  if (!response.ok) {
    throw new Error(\`Kokoro TTS failed: \${response.statusText}\`);
  }

  const data = await response.json();
  if (!data.audio_base64 || !data.timestamps) {
    throw new Error("Invalid response format from Kokoro");
  }

  return {
    audioUrl: \`data:audio/wav;base64,\${data.audio_base64}\`,
    timestamps: data.timestamps.map((t: any) => ({
      word: t.word,
      start: t.start_time,
      end: t.end_time
    }))
  };
}
`;

if (!code.includes('synthesizeKokoroSpeech')) {
  // Find a good place to insert it, maybe before app.post('/api/tts/cartesia'
  code = code.replace("app.post('/api/tts/cartesia', async (req, res) => {", kokoroHelper + "\napp.post('/api/tts/cartesia', async (req, res) => {");
}

const oldLoop = `          const context = ws.context({
              model_id: 'sonic-3.5',
              voice: { mode: 'id', id: '62ae83ad-4f6a-430b-af41-a9bede9286ca' },
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
          }`;

const newLoop = `          const cleanChunk = normalizeTextForCartesia(chunk.text);
          let spokenText = cleanChunk;
          if (/\\\\(?:int|sum|begin|sin|cos|lim|frac|sqrt|tan|prod|theta|alpha|beta|gamma|omega|sigma)|\\\\{|\\\\}/i.test(chunk.text)) {
              spokenText = await normalizeTextWithLLM(cleanChunk);
          }

          try {
            // Try Kokoro first
            const kokoroResult = await synthesizeKokoroSpeech(spokenText);
            res.write(JSON.stringify({
                index: i,
                domIndex: chunk.domIndex,
                text: chunk.text,
                audioUrl: kokoroResult.audioUrl,
                timestamps: kokoroResult.timestamps
            }) + '\\n');
          } catch (kokoroErr) {
            console.error('Kokoro TTS failed, falling back to Cartesia:', kokoroErr.message);
            
            // Fallback to Cartesia
            const context = ws.context({
                model_id: 'sonic-3.5',
                voice: { mode: 'id', id: '62ae83ad-4f6a-430b-af41-a9bede9286ca' },
                output_format: { container: 'raw', encoding: 'pcm_f32le', sample_rate: 44100 },
                add_timestamps: true
            });

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
          }`;

code = code.replace(oldLoop, newLoop);
fs.writeFileSync('server.ts', code);
console.log("Updated server.ts with Kokoro");
