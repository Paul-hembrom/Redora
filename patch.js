const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
    /for await \(const message of context.receive\(\)\) \{\n\s*if \(message.audio\)/,
    "for await (const message of context.receive()) {\n            const msg = message as any;\n            if (msg.audio)"
);
code = code.replace(/message.audio/g, "msg.audio");
code = code.replace(/message.word_timestamps/g, "msg.word_timestamps");
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts");
