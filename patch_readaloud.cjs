const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regexScroll = /\/\/ Sentence-level auto-scroll.*?if \(fallbackEl\) \{\n                 fallbackEl\.scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\);\n             \}\n           \}/s;

code = code.replace(regexScroll, ''); // Remove from onplay

const regexLoop = /let chunkCompleted = false;\n        let animationFrameId: number;\n\n        const highlightLoop = \(\) => \{/s;

const newLoop = `let chunkCompleted = false;
        let hasScrolled = false;
        let animationFrameId: number;

        const highlightLoop = () => {
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
            }`;

code = code.replace(regexLoop, newLoop);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Patched ReadAloudButton");
