const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// Set it after src, and also defaultPlaybackRate
const findStr = `        const audio = audioRef.current;\n        audio.playbackRate = 0.8;\n        audio.src = chunk.audioUrl;`;
const replaceStr = `        const audio = audioRef.current;\n        audio.src = chunk.audioUrl;\n        audio.playbackRate = 0.8;\n        audio.defaultPlaybackRate = 0.8;`;

content = content.replace(findStr, replaceStr);

// Also set it right before playPromise
content = content.replace(/const playPromise = audio\.play\(\);/g, `audio.playbackRate = 0.8;\n        const playPromise = audio.play();`);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Fixed playbackRate setting");
