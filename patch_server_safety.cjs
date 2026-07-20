const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /for await \(const message of context\.receive\(\)\) \{[\s\S]*?res\.write\(JSON\.stringify\(\{\s*index: i,\s*domIndex: chunk\.domIndex,\s*text: chunk\.text,\s*audioUrl: audioUrl,\s*timestamps: timestamps\s*\}\) \+ '\\n'\);/m;

const newLoop = `for await (const message of context.receive()) {
            if (message.type === 'chunk') {
                if (message.data) {
                    const buf = Buffer.from(message.data, 'base64');
                    audioBuffers.push(buf);
                } else {
                    console.warn(\`Cartesia TTS: Chunk message missing 'data' property.\`);
                }
            }
            if (message.type === 'timestamps') {
                if (message.word_timestamps && message.word_timestamps.words) {
                    for (let k = 0; k < message.word_timestamps.words.length; k++) {
                        timestamps.push({
                            word: message.word_timestamps.words[k],
                            start: message.word_timestamps.start[k],
                            end: message.word_timestamps.end[k]
                        });
                    }
                } else {
                    console.warn(\`Cartesia TTS: Timestamps message missing 'word_timestamps' property.\`);
                }
            }
        }
        
        const rawAudio = Buffer.concat(audioBuffers);
        let audioUrl = '';
        if (rawAudio.length === 0) {
            console.warn(\`Cartesia TTS: No audio received for chunk \${i}\`);
        } else {
            const header = createFloat32WavHeader(rawAudio.length, 44100);
            const finalBuffer = Buffer.concat([header, rawAudio]);
            audioUrl = 'data:audio/wav;base64,' + finalBuffer.toString('base64');
        }

        res.write(JSON.stringify({
            index: i,
            domIndex: chunk.domIndex,
            text: chunk.text,
            audioUrl: audioUrl,
            timestamps: timestamps
        }) + '\\n');`;

if (regex.test(code)) {
    code = code.replace(regex, newLoop);
    fs.writeFileSync('server.ts', code);
    console.log('Patched correctly!');
} else {
    console.log('Could not find old loop to replace!');
}
