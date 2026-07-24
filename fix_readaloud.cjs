const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regexLoop = /const highlightLoop = \(\) => \{\n            if \(stopIntentRef\.current \|\| chunkCompleted \|\| audio\.paused \|\| audio\.ended\) return;\n\n            const currentTime = audio\.currentTime;[\s\S]*?if \(currentTime > 0\.05 && !hasScrolled\) \{[\s\S]*?\}\n            \}\n            if \(stopIntentRef\.current \|\| chunkCompleted/s;

const replacement = `const highlightLoop = () => {
            if (stopIntentRef.current || chunkCompleted || audio.paused || audio.ended) return;

            const currentTime = audio.currentTime;
            
            if (currentTime > 0.05 && !hasScrolled) {
               hasScrolled = true;
               const sentenceSpan = document.getElementById(\`tts-sentence-\${i}\`);
               if (sentenceSpan) {
                 sentenceSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
               } else {
                 const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
                 const scopeRoot = getScopeRoot();
                 let fallbackEl = scopeRoot.querySelector(\`[id="\${idPrefix}\${domIndex}"]\`);
                 if (!fallbackEl && idPrefix.startsWith("tts-explanation-")) {
                     fallbackEl = scopeRoot.querySelector(\`[id="\${idPrefix}0"]\`);
                 }
                 if (fallbackEl) {
                     fallbackEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 }
               }
            }

            if (stopIntentRef.current || chunkCompleted`;

code = code.replace(regexLoop, replacement);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Fixed ReadAloudButton");
