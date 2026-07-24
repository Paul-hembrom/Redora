const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldRegex = /let chunkCompleted = false;[\s\S]*?const timeUpdateHandler = \(\) => \{[\s\S]*?audio\.addEventListener\('timeupdate', timeUpdateHandler\);\n        \};\n\n        audio\.onpause = \(\) => \{\n           logInfo\(\`Chunk \$\{i\} paused\.\`\);\n           audio\.removeEventListener\('timeupdate', timeUpdateHandler\);\n           removeHighlights\(\);\n        \};\n\n        audio\.onended = \(\) => \{\n           if \(chunkCompleted\) return;\n           logInfo\(\`Chunk \$\{i\} ended natively\.\`\);\n           chunkCompleted = true;\n           audio\.removeEventListener\('timeupdate', timeUpdateHandler\);\n           removeHighlights\(\);\n           i\+\+;\n           isPlayingNext = false;\n           playNextChunk\(\);\n        \};/m;

const newLoop = `let chunkCompleted = false;
        let animationFrameId: number;

        const highlightLoop = () => {
            if (stopIntentRef.current || chunkCompleted || audio.paused || audio.ended) return;

            const currentTime = audio.currentTime;
            
            // Fix premature ending
            if (audio.duration && currentTime >= Math.max(0, audio.duration - 0.1) && !chunkCompleted) {
                chunkCompleted = true;
                logInfo(\`Chunk \${i} completed via requestAnimationFrame.\`);
                removeHighlights();
                i++;
                isPlayingNext = false;
                playNextChunk();
                return;
            }

            if (chunk.timestamps) {
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
           animationFrameId = requestAnimationFrame(highlightLoop);
        };

        audio.onpause = () => {
           logInfo(\`Chunk \${i} paused.\`);
           cancelAnimationFrame(animationFrameId);
           removeHighlights();
        };

        audio.onended = () => {
           if (chunkCompleted) return;
           logInfo(\`Chunk \${i} ended natively.\`);
           chunkCompleted = true;
           cancelAnimationFrame(animationFrameId);
           removeHighlights();
           i++;
           isPlayingNext = false;
           playNextChunk();
        };`;

code = code.replace(oldRegex, newLoop);
fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Patched loop");
