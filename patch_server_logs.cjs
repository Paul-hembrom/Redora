const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /for await \(const message of context\.receive\(\)\) \{([\s\S]*?)\}        \n        const rawAudio = Buffer\.concat\(audioBuffers\);/m;

const newLoop = `for await (const message of context.receive()) {
            console.log('[Cartesia] Msg type:', message.type, 'Keys:', Object.keys(message));
            if (message.type === 'chunk') {
                if (message.data) {
                    const buf = Buffer.from(message.data, 'base64');
                    audioBuffers.push(buf);
                } else {
                    console.warn(\`Cartesia TTS: Chunk message missing 'data' property. Keys: \`, Object.keys(message));
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
                    console.warn(\`Cartesia TTS: Timestamps message missing 'word_timestamps' property. Keys: \`, Object.keys(message));
                }
            }
        }
        console.log('[Cartesia] Total audio buffers for chunk:', audioBuffers.length, 'Total timestamps:', timestamps.length);
        const rawAudio = Buffer.concat(audioBuffers);`;

if (regex.test(code)) {
    code = code.replace(regex, newLoop);
    fs.writeFileSync('server.ts', code);
    console.log('Patched server logs!');
} else {
    console.log('Could not find old loop for logs!');
}
