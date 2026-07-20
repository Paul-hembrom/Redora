const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /for await \(const message of context\.receive\(\)\) \{\s*if \(message\.audio\) \{\s*const buf = Buffer\.from\(message\.audio, 'base64'\);\s*audioBuffers\.push\(buf\);\s*\}\s*if \(message\.word_timestamps\) \{\s*for \(let k = 0; k < message\.word_timestamps\.words\.length; k\+\+\) \{\s*timestamps\.push\(\{\s*word: message\.word_timestamps\.words\[k\],\s*start: message\.word_timestamps\.start\[k\],\s*end: message\.word_timestamps\.end\[k\]\s*\}\);\s*\}\s*\}\s*\}/;

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

if (regex.test(code)) {
    code = code.replace(regex, newLoop);
    fs.writeFileSync('server.ts', code);
    console.log('Patched');
} else {
    console.log('Could not find regex match');
}
