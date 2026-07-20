const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldLoop = `for await (const message of context.receive()) {
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
        }`;

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
        console.log('[Cartesia] Chunk complete. Buffers:', audioBuffers.length, 'Timestamps:', timestamps.length);`;

if (code.includes(oldLoop)) {
    code = code.replace(oldLoop, newLoop);
    fs.writeFileSync('server.ts', code);
    console.log('Patched server logs 2!');
} else {
    console.log('Could not find old loop for logs 2!');
}
