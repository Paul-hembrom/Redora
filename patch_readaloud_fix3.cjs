const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const errorStr = `        audio.onerror = (e) => {
          console.error('[ReadAloud] Audio error:', audio.error?.code, audio.error?.message);
          logError(\`Chunk \${i} audio element error\`, e);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
             isQueuePlaying = false;
          } else {
             playNextChunk();
          }
        };`;

const newErrorStr = `        audio.onerror = (e) => {
          console.error('[ReadAloud] Audio error:', audio.error?.code, audio.error?.message);
          logError(\`Chunk \${i} audio element error\`, e);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
             isQueuePlaying = false;
          } else {
             if (audio.parentElement) {
                 audio.parentElement.removeChild(audio);
             }
             playNextChunk();
          }
        };`;

content = content.replace(errorStr, newErrorStr);
fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
