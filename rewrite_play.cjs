const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// Ensure log is added if not present
if (!content.includes('Actual playbackRate:')) {
    content = content.replace(/playPromise\.then\(\(\) => \{/, "playPromise.then(() => {\n                console.log('[ReadAloud] Actual playbackRate:', audio.playbackRate);");
}

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Rewrote play promise");
