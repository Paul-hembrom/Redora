const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// First replace the loop variable and add casting
code = code.replace(
    /for await \(const message of context.receive\(\)\) \{\n\s+if \(message\.audio\)/g,
    `for await (const message of context.receive()) {
            const msg = message as any;
            if (msg.audio)`
);

// Then replace all message.audio and message.word_timestamps inside that context
// But since there might be other usages, it's safer to just replace all within that specific function, or just generally replace in the file if there's no collision.
// Let's do a more precise replacement:

code = code.replace(
    /if \(message\.audio\) \{\n\s+const buf = Buffer\.from\(message\.audio, 'base64'\);\n\s+audioBuffers\.push\(buf\);\n\s+\}\n\s+if \(message\.word_timestamps\) \{\n\s+for \(let k = 0; k < message\.word_timestamps\.words\.length; k\+\+\) \{\n\s+timestamps\.push\(\{\n\s+word: message\.word_timestamps\.words\[k\],\n\s+start: message\.word_timestamps\.start\[k\],\n\s+end: message\.word_timestamps\.end\[k\]\n\s+\}\);\n\s+\}\n\s+\}/g,
    `if (msg.audio) {
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
            }`
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts");
