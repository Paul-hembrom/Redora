const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regex = /let hasScrolled = false;[\s\S]*?playNextChunk\(\);\s*\};/m;

const originalStr = `        let hasScrolled = false;
        let animationFrameId: number;

        const highlightLoop = () => {
            if (stopIntentRef.current || audio.paused || audio.ended) return;

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

            if (chunk.timestamps && chunk.timestamps.length > 0) {
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
            }

            animationFrameId = requestAnimationFrame(highlightLoop);
        };

        audio.onplay = () => {
           console.log('[ReadAloud] Audio onplay fired');
           logInfo(\`Chunk \${i} started playing.\`);
           
           if (!chunk.timestamps || stopIntentRef.current) return;
           animationFrameId = requestAnimationFrame(highlightLoop);
        };

        audio.onpause = () => {
           console.log('[ReadAloud] Audio onpause fired');
           logInfo(\`Chunk \${i} paused.\`);
           cancelAnimationFrame(animationFrameId);
           removeHighlights();
        };

        audio.onended = () => {
           console.log('[ReadAloud] Audio onended fired');
           logInfo(\`Chunk \${i} ended natively.\`);
           cancelAnimationFrame(animationFrameId);
           removeHighlights();

           playNextChunk();
        };`;

content = content.replace(regex, originalStr);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Restored ReadAloudButton.tsx successfully");
