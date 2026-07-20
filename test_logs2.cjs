const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
    /if \(msg.word_timestamps\) \{/,
    `if (msg.word_timestamps) {
                console.log("Got word_timestamps from Cartesia:", msg.word_timestamps);`
);

fs.writeFileSync('server.ts', code);
console.log("added debugging 2");
