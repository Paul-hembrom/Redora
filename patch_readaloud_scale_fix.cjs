const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const targetStr = `        const scaleFactor = (chunk.rawDuration && chunk.playbackDuration) 
            ? (chunk.playbackDuration / chunk.rawDuration) 
            : (1 / playbackRate);`;

const newTargetStr = `        const scaleFactor = (chunk.rawDuration && chunk.playbackDuration) 
            ? (chunk.rawDuration / chunk.playbackDuration) 
            : (playbackRate);`;

content = content.replace(targetStr, newTargetStr);

const currentTimeStr = `const currentTime = audio.currentTime * scaleFactor;`;
const newCurrentTimeStr = `const currentTime = audio.currentTime;`;

content = content.replace(currentTimeStr, newCurrentTimeStr);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Patched successfully");
