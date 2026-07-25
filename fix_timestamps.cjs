const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// Remove front-end scaling
content = content.replace(/let startAdjusted = start_time;\s*let endAdjusted = end_time;\s*if \(i === 0\) \{\s*startAdjusted -= 0\.150;\s*endAdjusted -= 0\.150;\s*\}/g, 'let startAdjusted = start_time;\n                    let endAdjusted = end_time;');

// Log playback rate after play
content = content.replace(/audio\.play\(\)\.catch\(\(e\) => \{/g, `audio.play().then(() => {\n            console.log('[ReadAloud] Actual playbackRate:', audio.playbackRate);\n        }).catch((e) => {`);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Fixed timestamps scaling and play logging");
