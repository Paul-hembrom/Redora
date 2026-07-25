const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// 1. Add log after audio.play()
const playCode = `const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('[Frontend] Audio playbackRate after play:', audio.playbackRate, 'src length:', audio.src.length);`;

content = content.replace(/const playPromise = audio\.play\(\);\n\s*if \(playPromise !== undefined\) \{\n\s*playPromise\.then\(\(\) => \{/g, playCode);

// 2. Add log when chunk is received
const receiveCode = `const isValid = data.audioUrl && data.audioUrl.startsWith('data:audio/');
                  logInfo(\`Received chunk \${data.index}. Audio URL valid: \${!!isValid}\`);
                  if (data.timestamps && data.timestamps.length > 0) {
                      console.log(\`[Frontend] Chunk \${data.index} – first timestamp:\`, JSON.stringify(data.timestamps[0]), 'last timestamp:', JSON.stringify(data.timestamps[data.timestamps.length - 1]));
                  }
                  chunksMapRef.current.set(data.index, data);`;

content = content.replace(/const isValid = data\.audioUrl && data\.audioUrl\.startsWith\('data:audio\/'\);\n\s*logInfo\(\`Received chunk \$\{data\.index\}\. Audio URL valid: \$\{\!\!isValid\}\`\);\n\s*chunksMapRef\.current\.set\(data\.index, data\);/g, receiveCode);

// 3. Add RAF log
const rafCode = `const wordSpan = document.getElementById(spanId);
                const activeWordText = wordSpan ? wordSpan.innerText : 'unknown';
                if (!window._lastRafLog || Date.now() - window._lastRafLog > 1000) {
                    console.log('[Frontend] RAF – currentTime:', currentTime.toFixed(2), 'active word:', activeWordText, 'progress:', (span.style.background ? 'active' : 'inactive'));
                    window._lastRafLog = Date.now();
                }

                if (currentTime >= startAdjusted && currentTime < endAdjusted) {`;

content = content.replace(/if \(currentTime >= startAdjusted && currentTime < endAdjusted\) \{/g, rafCode);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Added logs to ReadAloudButton.tsx");
