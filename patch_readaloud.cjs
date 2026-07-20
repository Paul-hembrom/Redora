const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldTimeUpdate = `        const timeUpdateHandler = () => {
            if (stopIntentRef.current) return;
            const currentTime = audio.currentTime;

            chunk.timestamps.forEach((ts: any, k: number) => {
                const span = wordSpans[k];
                if (!span) return;

                const start_time = ts.start_time !== undefined ? ts.start_time : ts.start;
                const end_time = ts.end_time !== undefined ? ts.end_time : ts.end;

                let startAdjusted = start_time;
                let endAdjusted = end_time;
                if (i === 0) {
                    startAdjusted -= 0.150;
                    endAdjusted -= 0.150;
                }

                if (currentTime >= startAdjusted && currentTime < endAdjusted) {
                    span.classList.add('bg-amber-400/70');
                } else {
                    span.classList.remove('bg-amber-400/70');
                }
            });
        };

        audio.onplay = () => {
           logInfo(\`Chunk \${i} started playing.\`);
           if (!chunk.timestamps || stopIntentRef.current) return;
           audio.addEventListener('timeupdate', timeUpdateHandler);
        };`;

const newTimeUpdate = `        const timeUpdateHandler = () => {
            if (stopIntentRef.current) return;
            const currentTime = audio.currentTime;

            chunk.timestamps.forEach((ts: any, k: number) => {
                let span = document.getElementById(\`tts-word-\${i}-\${k}\`);
                if (!span) span = wordSpans[k];
                if (!span) return;

                const start_time = ts.start_time !== undefined ? ts.start_time : ts.start;
                const end_time = ts.end_time !== undefined ? ts.end_time : ts.end;

                let startAdjusted = start_time;
                let endAdjusted = end_time;
                if (i === 0) {
                    startAdjusted -= 0.150;
                    endAdjusted -= 0.150;
                }

                if (currentTime >= startAdjusted && currentTime < endAdjusted) {
                    span.classList.add('bg-amber-400/70');
                } else {
                    span.classList.remove('bg-amber-400/70');
                }
            });
        };

        audio.onplay = () => {
           logInfo(\`Chunk \${i} started playing.\`);
           
           // Sentence-level auto-scroll – When the i-th audio chunk starts playing
           const sentenceSpan = document.getElementById(\`tts-sentence-\${i}\`);
           if (sentenceSpan) {
             sentenceSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
           } else {
             // Fallback for our own dynamic domIndex scrolling
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

           if (!chunk.timestamps || stopIntentRef.current) return;
           audio.addEventListener('timeupdate', timeUpdateHandler);
        };`;

code = code.replace(oldTimeUpdate, newTimeUpdate);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Patched ReadAloudButton timeUpdate and onplay");
