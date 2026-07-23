const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const timeUpdateRegex = /const timeUpdateHandler = \(\) => \{[\s\S]*?\}\);[\s\S]*?\};/;
const oldTimeUpdate = `        const timeUpdateHandler = () => {
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
        };`;

const newTimeUpdate = `        let chunkCompleted = false;
        const timeUpdateHandler = () => {
            if (stopIntentRef.current) return;
            const currentTime = audio.currentTime;
            
            // Fix premature ending
            if (audio.duration && currentTime >= Math.max(0, audio.duration - 0.1) && !chunkCompleted) {
                chunkCompleted = true;
                logInfo(\`Chunk \${i} completed via timeupdate.\`);
                audio.removeEventListener('timeupdate', timeUpdateHandler);
                removeHighlights();
                i++;
                isPlayingNext = false;
                playNextChunk();
                return;
            }

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
        };`;

code = code.replace(oldTimeUpdate, newTimeUpdate);

const oldOnEnded = `        audio.onended = () => {
           logInfo(\`Chunk \${i} ended.\`);
           audio.removeEventListener('timeupdate', timeUpdateHandler);
           removeHighlights();
           i++;
           isPlayingNext = false;
           playNextChunk();
        };`;

const newOnEnded = `        audio.onended = () => {
           if (chunkCompleted) return;
           logInfo(\`Chunk \${i} ended natively.\`);
           chunkCompleted = true;
           audio.removeEventListener('timeupdate', timeUpdateHandler);
           removeHighlights();
           i++;
           isPlayingNext = false;
           playNextChunk();
        };`;

code = code.replace(oldOnEnded, newOnEnded);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("Patched ReadAloudButton chunkCompleted");
