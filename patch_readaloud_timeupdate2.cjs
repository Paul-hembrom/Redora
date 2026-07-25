const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regex = /const scaleFactor = \([\s\S]*?playNextChunk\(\);\s*\};/m;

const newTargetStr = `let hasScrolled = false;

        const timeUpdateHandler = () => {
            if (stopIntentRef.current) return;

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
               const totalWords = chunk.timestamps.length;
               const audioDuration = audio.duration || chunk.playbackDuration || chunk.rawDuration || 1;
               
               if (audioDuration > 0) {
                   const progressPercentage = currentTime / audioDuration;
                   const currentWordIndex = Math.min(
                       Math.floor(progressPercentage * totalWords),
                       totalWords - 1
                   );
                   
                   // Remove highlights from all words, add to current
                   wordSpans.forEach((span, k) => {
                       let domSpan = document.getElementById(\`tts-word-\${i}-\${k}\`);
                       if (!domSpan) domSpan = span;
                       if (!domSpan) return;
                       
                       if (k === currentWordIndex) {
                           domSpan.classList.add('bg-amber-400/70');
                       } else {
                           domSpan.classList.remove('bg-amber-400/70');
                       }
                   });
               }
            }
        };

        audio.addEventListener('timeupdate', timeUpdateHandler);

        audio.onplay = () => {
           console.log('[ReadAloud] Audio onplay fired');
           logInfo(\`Chunk \${i} started playing.\`);
        };

        audio.onpause = () => {
           console.log('[ReadAloud] Audio onpause fired');
           logInfo(\`Chunk \${i} paused.\`);
           removeHighlights();
        };

        audio.onended = () => {
           console.log('[ReadAloud] Audio onended fired');
           logInfo(\`Chunk \${i} ended natively.\`);
           removeHighlights();
           audio.removeEventListener('timeupdate', timeUpdateHandler);

           playNextChunk();
        };`;

content = content.replace(regex, newTargetStr);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Patched ReadAloudButton.tsx successfully with new code");
