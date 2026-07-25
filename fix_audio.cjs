const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// Ensure playback rate is 0.8
content = content.replace(/audio\.playbackRate = playbackRate;/g, 'audio.playbackRate = 0.8;');

// After play(), log playback rate
const playRegex = /audio\.play\(\)\.then\(\(\) => \{([\s\S]*?)\}\)\.catch\(\(err\) => \{/g;
content = content.replace(playRegex, 'audio.play().then(() => {\n            console.log("[ReadAloud] Actual playbackRate:", audio.playbackRate);\n$1}).catch((err) => {');

// Remove pause/src clearance from multiple elements? We only use audioRef.current so it's a single element. But wait, `playNextChunk` does this:
// Next audio preload doesn't play, but just in case:
content = content.replace(/if \(!audioRef\.current\) \{/g, `if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }
        if (!audioRef.current) {`);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Fixed audio playback rate");
