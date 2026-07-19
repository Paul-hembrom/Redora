const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldLogic = `        const updateHighlights = () => {
           if (audio !== audioRef.current || stopIntentRef.current || audio.paused || audio.ended) {
               if (highlightOverlay) highlightOverlay.style.opacity = '0';
               return;
           }
           const currentTime = audio.currentTime;
           let activeRange = null;
           if (chunk.timestamps && chunk.timestamps.length > 0) {
               for (let k = 0; k < chunk.timestamps.length; k++) {
                   const ts = chunk.timestamps[k];
                   if (currentTime >= ts.start && currentTime <= ts.end) {
                       activeRange = ranges[k];
                       break;
                   }
               }
           }
           if (activeRange && highlightOverlay) {
               const rect = activeRange.getBoundingClientRect();
               highlightOverlay.style.top = \`\${rect.top + window.scrollY}px\`;
               highlightOverlay.style.left = \`\${rect.left + window.scrollX}px\`;
               highlightOverlay.style.width = \`\${rect.width}px\`;
               highlightOverlay.style.height = \`\${rect.height}px\`;
               highlightOverlay.style.opacity = '1';
           } else if (highlightOverlay) {
               highlightOverlay.style.opacity = '0';
           }
           requestAnimationFrame(updateHighlights);
        };
        
        audio.onplay = () => requestAnimationFrame(updateHighlights);`;

const newLogic = `        let highlightTimeouts: NodeJS.Timeout[] = [];
        
        const clearHighlightTimeouts = () => {
            highlightTimeouts.forEach(clearTimeout);
            highlightTimeouts = [];
        };

        audio.onplay = () => {
           if (!chunk.timestamps || stopIntentRef.current) return;
           
           // Use setTimeout relative to audio currentTime to schedule highlights
           chunk.timestamps.forEach((ts, k) => {
               const activeRange = ranges[k];
               if (!activeRange || !highlightOverlay) return;
               
               const start_time = ts.start_time !== undefined ? ts.start_time : ts.start;
               const end_time = ts.end_time !== undefined ? ts.end_time : ts.end;
               
               // Calculate delay considering current playback time and playback rate
               const startDelay = Math.max(0, (start_time - audio.currentTime)) * 1000 / playbackRate;
               const endDelay = Math.max(0, (end_time - audio.currentTime)) * 1000 / playbackRate;
               
               const startTimer = setTimeout(() => {
                   if (stopIntentRef.current || audio !== audioRef.current || audio.paused) return;
                   const rect = activeRange.getBoundingClientRect();
                   highlightOverlay.style.top = \`\${rect.top + window.scrollY}px\`;
                   highlightOverlay.style.left = \`\${rect.left + window.scrollX}px\`;
                   highlightOverlay.style.width = \`\${rect.width}px\`;
                   highlightOverlay.style.height = \`\${rect.height}px\`;
                   highlightOverlay.style.opacity = '1';
               }, startDelay);
               
               const endTimer = setTimeout(() => {
                   if (stopIntentRef.current || audio !== audioRef.current || audio.paused) return;
                   if (k === chunk.timestamps.length - 1) {
                       highlightOverlay.style.opacity = '0';
                   }
               }, endDelay);
               
               highlightTimeouts.push(startTimer, endTimer);
           });
        };
        
        audio.onpause = clearHighlightTimeouts;
        audio.onended = () => {
           clearHighlightTimeouts();
           i++;
           isPlayingNext = false;
           playNextChunk();
        };`;

code = code.replace(oldLogic, newLogic);

// We need to remove the old audio.onended definition since we added it in newLogic
const oldOnEnded = `        audio.onended = () => {
          i++;
          isPlayingNext = false;
          playNextChunk();
        };`;
code = code.replace(oldOnEnded, '');

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched frontend highlighting');
