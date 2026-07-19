const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "import express from 'express';",
  "import express from 'express';\nimport { Cartesia } from '@cartesia/cartesia-js';"
);

const helpers = `
function chunkDocumentText(text: string) {
    const chunks: { text: string; domIndex: number }[] = [];
    const blocks = text.split(/\\n\\n+/).map((s: string) => s.trim()).filter(Boolean);
    blocks.forEach((block: string, domIndex: number) => {
        const sentences = block.match(/[^.!?]+[.!?]+(?:\\s+|$)|[^.!?]+$/g) || [block];
        sentences.forEach((s: string) => {
            const t = s.trim();
            if (t.length > 0) chunks.push({ text: t, domIndex });
        });
    });
    return chunks;
}

function createFloat32WavHeader(dataLength: number, sampleRate: number): Buffer {
    const buffer = Buffer.alloc(44);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(3, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 4, 28);
    buffer.writeUInt16LE(4, 32);
    buffer.writeUInt16LE(32, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);
    return buffer;
}
`;

const cartesiaEndpoint = `
app.post('/api/tts/cartesia', async (req, res) => {
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

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        const context = ws.context({
            model_id: 'sonic-english',
            voice: { mode: 'id', id: 'a0e99841-438c-4a64-b679-ae501e7d6091' },
            output_format: { container: 'raw', encoding: 'pcm_f32le', sample_rate: 44100 },
            add_timestamps: true
        });

        await context.send({ transcript: chunk.text });

        let audioBuffers: Buffer[] = [];
        let timestamps: any[] = [];

        for await (const message of context.receive()) {
            if (message.audio) {
                const buf = Buffer.from(message.audio, 'base64');
                audioBuffers.push(buf);
            }
            if (message.word_timestamps) {
                for (let k = 0; k < message.word_timestamps.words.length; k++) {
                    timestamps.push({
                        word: message.word_timestamps.words[k],
                        start: message.word_timestamps.start[k],
                        end: message.word_timestamps.end[k]
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
});
`;

code = code.replace("app.post('/api/tts/stream', async (req, res) => {", helpers + cartesiaEndpoint + "\\napp.post('/api/tts/stream', async (req, res) => {");

fs.writeFileSync('server.ts', code);
console.log('patched cartesia server');
