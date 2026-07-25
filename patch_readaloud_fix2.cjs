const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const playStr = `        const audio = new Audio();
        audio.playbackRate = playbackRate;
        audio.src = chunk.audioUrl;
        audioRef.current = audio;
        
        console.log('[ReadAloud] Audio element created – src length:', chunk.audioUrl?.length);`;

const newPlayStr = `        const audio = new Audio();
        audio.playbackRate = playbackRate;
        audio.src = chunk.audioUrl;
        audioRef.current = audio;
        
        console.log('[ReadAloud] Audio element created – src length:', chunk.audioUrl?.length);
        console.log('[ReadAloud] Audio src starts with:', chunk.audioUrl?.substring(0, 50));
        
        audio.style.display = 'none';
        document.body.appendChild(audio);

        audio.onloadedmetadata = () => console.log('[ReadAloud] Audio duration:', audio.duration);`;
content = content.replace(playStr, newPlayStr);

const audioEndedStr = `        audio.onended = () => {
           console.log('[ReadAloud] Audio ended');
           logInfo(\`Chunk \${i} ended natively.\`);
           cancelAnimationFrame(animationFrameId);
           removeHighlights();
           playNextChunk();
        };`;

const newAudioEndedStr = `        audio.onended = () => {
           console.log('[ReadAloud] Audio ended');
           logInfo(\`Chunk \${i} ended natively.\`);
           cancelAnimationFrame(animationFrameId);
           removeHighlights();
           if (audio.parentElement) {
               audio.parentElement.removeChild(audio);
           }
           playNextChunk();
        };`;
content = content.replace(audioEndedStr, newAudioEndedStr);

const playCatchStr = `        try {
          await audio.play();
          console.log('[ReadAloud] play() succeeded');
          playedChunks++;
        } catch (e: any) {
          console.error('[ReadAloud] play() rejected:', e.message);`;

const newPlayCatchStr = `        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('[ReadAloud] play() succeeded');
                playedChunks++;
            }).catch(err => {
                console.error('[ReadAloud] play() rejected:', err.name, err.message);
                logError(\`Chunk \${i} audio play threw error\`, err);
                
                // Retry logic
                setTimeout(async () => {
                    try {
                        await audio.play();
                        console.log('[ReadAloud] retry play() succeeded');
                        playedChunks++;
                    } catch (retryErr: any) {
                        console.error('[ReadAloud] retry play() rejected:', retryErr.message);
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
                    }
                }, 200);
            });
        }`;

content = content.replace(
`        try {
          await audio.play();
          console.log('[ReadAloud] play() succeeded');
          playedChunks++;
        } catch (e: any) {
          console.error('[ReadAloud] play() rejected:', e.message);
          logError(\`Chunk \${i} audio play threw error\`, e);
          
          // Retry logic
          setTimeout(async () => {
              try {
                  await audio.play();
                  console.log('[ReadAloud] retry play() succeeded');
                  playedChunks++;
              } catch (retryErr: any) {
                  console.error('[ReadAloud] retry play() rejected:', retryErr.message);
                  failedChunks++;
                  if (failedChunks > Math.max(1, totalChunks / 2)) {
                     showError('Audio unavailable for this content. Please try again later.');
                     setIsPlaying(false);
                     isQueuePlaying = false;
                  } else {
                     playNextChunk();
                  }
              }
          }, 200);
        }`, newPlayCatchStr);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
