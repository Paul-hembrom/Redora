const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldLoop = `        for await (const message of context.receive()) {
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
        }`;

const newLoop = `        for await (const message of context.receive()) {
            if (message.type === 'chunk' && message.data) {
                const buf = Buffer.from(message.data, 'base64');
                audioBuffers.push(buf);
            }
            if (message.type === 'timestamps' && message.word_timestamps) {
                for (let k = 0; k < message.word_timestamps.words.length; k++) {
                    timestamps.push({
                        word: message.word_timestamps.words[k],
                        start: message.word_timestamps.start[k],
                        end: message.word_timestamps.end[k]
                    });
                }
            }
        }`;

if (code.includes(oldLoop)) {
    code = code.replace(oldLoop, newLoop);
    fs.writeFileSync('server.ts', code);
    console.log('Patched');
} else {
    console.log('Could not find old loop');
}
