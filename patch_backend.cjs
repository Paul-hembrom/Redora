const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStart = `app.post('/api/tts/cartesia', async (req, res) => {
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
    let responseStream: any;`;

const replacementStart = `app.post('/api/tts/cartesia', async (req, res) => {
  try {
    const { text, highQuality } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });

    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY is not set');
      return res.status(500).json({ error: 'ElevenLabs API key missing' });
    }

    const chunks = chunkDocumentText(text);
    let responseStream: any;`;

code = code.replace(targetStart, replacementStart);

// Now replace the catch block where Cartesia fallback happens
const targetFallback = `            // Fallback to Cartesia
            if (!responseStream) {
                try {
                    responseStream = await cartesia.tts.websocket();
                    if (responseStream.source) {
                        responseStream.source.on('error', (err: any) => {
                            console.error('Cartesia WebSocket error (ignored):', err.message);
                        });
                    }
                } catch (wsErr) {
                    console.error('Failed to open Cartesia WebSocket (ignored for pre-warm):', wsErr);
                    continue; // Skip this chunk and continue
                }
            }

            const context = responseStream.context({
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
            }`;

const replacementFallback = `            // Fallback to ElevenLabs
            const voiceId = 'JwEIvMzFlLwrArLvqeM5'; // Katrina R
            const modelId = highQuality ? 'eleven_multilingual_v2' : 'eleven_flash_v2_5';
            console.log(\`[TTS] Using ElevenLabs model: \${modelId} (\${highQuality ? 'HQ' : 'Standard'})\`);

            const url = \`https://api.elevenlabs.io/v1/text-to-speech/\${voiceId}/stream?optimize_streaming_latency=3&with_timestamps=true&output_format=mp3_44100_128\`;
            try {
               const response = await fetch(url, {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json',
                   'xi-api-key': apiKey,
                 },
                 body: JSON.stringify({
                   text: spokenText,
                   model_id: modelId,
                   voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                 }),
               });
               
               if (!response.ok) {
                 console.error("ElevenLabs streaming API error:", await response.text());
                 continue;
               }

               const decoder = new TextDecoder();
               const reader = response.body.getReader();
               let buffer = '';
               let finalAudioBase64 = '';
               let chars = [];
               let startTimes = [];
               let durations = [];

               while (true) {
                   const { done, value } = await reader.read();
                   if (done) break;
                   buffer += decoder.decode(value, { stream: true });
                   let boundary = buffer.indexOf('\\n');
                   while (boundary !== -1) {
                       const line = buffer.slice(0, boundary).trim();
                       buffer = buffer.slice(boundary + 1);
                       if (line) {
                           try {
                               const data = JSON.parse(line);
                               if (data.audio_base64) finalAudioBase64 += data.audio_base64;
                               if (data.alignment) {
                                   if (data.alignment.chars) chars.push(...data.alignment.chars);
                                   if (data.alignment.charStartTimesMs) startTimes.push(...data.alignment.charStartTimesMs);
                                   if (data.alignment.charDurationsMs) durations.push(...data.alignment.charDurationsMs);
                               }
                           } catch(e) {}
                       }
                       boundary = buffer.indexOf('\\n');
                   }
               }

               if (buffer.trim()) {
                   try {
                       const data = JSON.parse(buffer);
                       if (data.audio_base64) finalAudioBase64 += data.audio_base64;
                       if (data.alignment) {
                           if (data.alignment.chars) chars.push(...data.alignment.chars);
                           if (data.alignment.charStartTimesMs) startTimes.push(...data.alignment.charStartTimesMs);
                           if (data.alignment.charDurationsMs) durations.push(...data.alignment.charDurationsMs);
                       }
                   } catch(e) {}
               }

               let timestamps = [];
               let currentWord = "";
               let wordStart = null;
               let wordEnd = null;

               for (let j = 0; j < chars.length; j++) {
                   const char = chars[j];
                   const start = startTimes[j];
                   const duration = durations[j];

                   if (char.trim() === "") {
                       if (currentWord.length > 0) {
                           timestamps.push({ word: currentWord, start: wordStart / 1000, end: wordEnd / 1000, start_time: wordStart / 1000, end_time: wordEnd / 1000 });
                           currentWord = "";
                           wordStart = null;
                       }
                   } else {
                       if (currentWord.length === 0) wordStart = start;
                       currentWord += char;
                       wordEnd = start + duration;
                   }
               }
               if (currentWord.length > 0) {
                   timestamps.push({ word: currentWord, start: wordStart / 1000, end: wordEnd / 1000, start_time: wordStart / 1000, end_time: wordEnd / 1000 });
               }

               if (finalAudioBase64) {
                 const audioUrl = \`data:audio/mpeg;base64,\${finalAudioBase64}\`;
                 res.write(JSON.stringify({
                    index: i,
                    domIndex: chunk.domIndex,
                    text: chunk.text,
                    audioUrl: audioUrl,
                    timestamps: timestamps
                 }) + '\\n');
               }
            } catch (elErr: any) {
               console.error("ElevenLabs fallback failed:", elErr.message);
            }`;

code = code.replace(targetFallback, replacementFallback);
fs.writeFileSync('server.ts', code);
