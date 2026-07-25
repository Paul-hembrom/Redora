const fs = require('fs');
let content = fs.readFileSync('readaloud_copy2.tsx', 'utf8');

content = content.replace(
`        if (!chunk.audioUrl) {
          logWarning(\`Chunk \${i} missing audioUrl.\`);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
             return;
          }
          i++;
          isPlayingNext = false;
          playNextChunk();
          return;
        }`,
`        if (!chunk.audioUrl) {
          logWarning(\`Chunk \${i} missing audioUrl.\`);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
             isQueuePlaying = false;
             return;
          }
          playNextChunk();
          return;
        }`
);

content = content.replace(
`        let chunkCompleted = false;
        let hasScrolled = false;
        let animationFrameId: number;

        const highlightLoop = () => {
            if (stopIntentRef.current || chunkCompleted || audio.paused || audio.ended) return;`,
`        let hasScrolled = false;
        let animationFrameId: number;

        const highlightLoop = () => {
            if (stopIntentRef.current || audio.paused || audio.ended) return;`
);

content = content.replace(
`            // Fix premature ending
            if (audio.duration && currentTime >= Math.max(0, audio.duration - 0.1) && !chunkCompleted) {
                chunkCompleted = true;
                logInfo(\`Chunk \${i} completed via requestAnimationFrame.\`);
                removeHighlights();
                i++;
                isPlayingNext = false;
                playNextChunk();
                return;
            }

            if (chunk.timestamps) {`,
`            if (chunk.timestamps) {`
);

content = content.replace(
`        audio.onended = () => {
           if (chunkCompleted) return;
           logInfo(\`Chunk \${i} ended natively.\`);
           chunkCompleted = true;
           cancelAnimationFrame(animationFrameId);
           removeHighlights();
           i++;
           isPlayingNext = false;
           playNextChunk();
        };`,
`        audio.onended = () => {
           logInfo(\`Chunk \${i} ended natively.\`);
           cancelAnimationFrame(animationFrameId);
           removeHighlights();
           playNextChunk();
        };`
);

content = content.replace(
`        audio.onerror = (e) => {
          logError(\`Chunk \${i} audio element error\`, e);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
          } else {
             i++;
             isPlayingNext = false;
             playNextChunk();
          }
        };`,
`        audio.onerror = (e) => {
          logError(\`Chunk \${i} audio element error\`, e);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
             isQueuePlaying = false;
          } else {
             playNextChunk();
          }
        };`
);

content = content.replace(
`        try {
          await audio.play();
          playedChunks++;
        } catch (e) {
          logError(\`Chunk \${i} audio play threw error\`, e);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
          } else {
             i++;
             isPlayingNext = false;
             playNextChunk();
          }
        }`,
`        try {
          await audio.play();
          playedChunks++;
        } catch (e) {
          logError(\`Chunk \${i} audio play threw error\`, e);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
             isQueuePlaying = false;
          } else {
             playNextChunk();
          }
        }`
);

fs.writeFileSync('readaloud_copy3.tsx', content);
