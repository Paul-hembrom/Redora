const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Remove PLAYBACK_RATE from backend
content = content.replace(/const PLAYBACK_RATE = 0\.8;/g, "");
content = content.replace(/const playbackDuration = rawDuration \/ PLAYBACK_RATE;/g, "const playbackDuration = rawDuration;");

// Remove scaling
content = content.replace(/const scaleFactor = playbackDuration \/ rawDuration;\n      mappedTimestamps = mappedTimestamps\.map\(\(t: any\) => \(\{\n        word: t\.word,\n        start: \+\(t\.start \* scaleFactor\)\.toFixed\(4\),\n        end:   \+\(t\.end   \* scaleFactor\)\.toFixed\(4\)\n      \}\)\);/g, "");

fs.writeFileSync('server.ts', content);
console.log("Fixed Kokoro backend scaling");
