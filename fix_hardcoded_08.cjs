const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// Replace `audio.playbackRate = 0.8;` with `audio.playbackRate = playbackRate;`
content = content.replace(/audio\.playbackRate = 0\.8;/g, "audio.playbackRate = playbackRate;");
content = content.replace(/audio\.defaultPlaybackRate = 0\.8;/g, "audio.defaultPlaybackRate = playbackRate;");

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Fixed hardcoded 0.8 to playbackRate prop");
