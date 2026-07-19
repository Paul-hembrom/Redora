const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Update chunkDocumentText
const newChunker = `function chunkDocumentText(text: string, maxChunkSize = 300) {
    const chunks: { text: string; domIndex: number }[] = [];
    const blocks = text.split(/\\n\\n+/).map((s: string) => s.trim()).filter(Boolean);
    blocks.forEach((block: string, domIndex: number) => {
        const sentences = block.match(/[^.!?]+[.!?]+(?:\\s+|$)|[^.!?]+$/g) || [block];
        let currentChunk = "";
        sentences.forEach((s: string) => {
            const t = s.trim();
            if (t.length > 0) {
                if (currentChunk.length + t.length > maxChunkSize && currentChunk.length > 0) {
                    chunks.push({ text: currentChunk.trim(), domIndex });
                    currentChunk = t;
                } else {
                    currentChunk = currentChunk ? currentChunk + " " + t : t;
                }
            }
        });
        if (currentChunk.length > 0) {
            chunks.push({ text: currentChunk.trim(), domIndex });
        }
    });
    return chunks;
}`;
code = code.replace(/function chunkDocumentText\([\s\S]*?return chunks;\n\}/, newChunker);

// 2. Replace Cartesia loop
const oldCartesiaHandler = `    res.write(JSON.stringify({ totalChunks: chunks.length }) + '\\n');

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

        let spokenText = normalizeTextForCartesia(chunk.text);
        if (/\\[a-zA-Z]+|\\{|\\}/.test(chunk.text)) {
            if (ttsNormalizationCache.has(chunk.text)) {
                spokenText = ttsNormalizationCache.get(chunk.text)!;
            } else {
                spokenText = await normalizeTextForTTS(spokenText);
                ttsNormalizationCache.set(chunk.text, spokenText);
            }
        }

        await context.send({ transcript: spokenText });

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
    res.end();`;

const newCartesiaHandler = `    res.write(JSON.stringify({ totalChunks: 1 }) + '\\n');

    const cartesia = new Cartesia({ apiKey });
    const ws = await cartesia.tts.websocket();
    ws.on('error', (err) => {
      console.error('Cartesia WebSocket error:', err);
    });

    const context = ws.context({
        model_id: 'sonic-3.5',
        voice: { mode: 'id', id: 'a0e99841-438c-4a64-b679-ae501e7d6091' },
        output_format: { container: 'raw', encoding: 'pcm_f32le', sample_rate: 44100 },
        add_timestamps: true
    });

    let audioBuffers: Buffer[] = [];
    let timestamps: any[] = [];

    const receivePromise = (async () => {
        for await (const message of context.receive()) {
            if (message.audio) {
                audioBuffers.push(Buffer.from(message.audio, 'base64'));
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
    })();

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLastChunk = i === chunks.length - 1;
        
        let spokenText = normalizeTextForCartesia(chunk.text);
        if (/\\[a-zA-Z]+|\\{|\\}/.test(chunk.text)) {
            if (ttsNormalizationCache.has(chunk.text)) {
                spokenText = ttsNormalizationCache.get(chunk.text)!;
            } else {
                spokenText = await normalizeTextForTTS(spokenText);
                ttsNormalizationCache.set(chunk.text, spokenText);
            }
        }

        await context.send({
            transcript: spokenText,
            continue: !isLastChunk
        });

        if (!isLastChunk) {
            await new Promise(resolve => setTimeout(resolve, 40));
        }
    }

    await receivePromise;
    ws.close();

    const rawAudio = Buffer.concat(audioBuffers);
    const header = createFloat32WavHeader(rawAudio.length, 44100);
    const finalBuffer = Buffer.concat([header, rawAudio]);
    const audioUrl = 'data:audio/wav;base64,' + finalBuffer.toString('base64');

    res.write(JSON.stringify({
        index: 0,
        domIndex: chunks[0].domIndex,
        text: text,
        audioUrl: audioUrl,
        timestamps: timestamps
    }) + '\\n');
    res.end();`;

code = code.replace(oldCartesiaHandler, newCartesiaHandler);
fs.writeFileSync('server.ts', code);
console.log('patched');
