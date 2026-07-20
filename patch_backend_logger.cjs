const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
    /if \(msg.word_timestamps\) \{/,
    `if (msg.word_timestamps) {
                fs.appendFileSync('cartesia_timestamps.log', JSON.stringify(msg.word_timestamps) + "\\n");`
);

fs.writeFileSync('server.ts', code);
console.log("added backend logger");
