const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// 1. Add unlock to triggerSpeech
const triggerStr = `  const triggerSpeech = async () => {
    if (isPlaying || isLoading) {
      stopPlaying();
      return;
    }

    stopIntentRef.current = false;
    await tryCartesiaTTS();
  };`;

const newTriggerStr = `  const triggerSpeech = async () => {
    if (isPlaying || isLoading) {
      stopPlaying();
      return;
    }

    stopIntentRef.current = false;
    
    // Unlock audio context for mobile/safari
    try {
      const unlockAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      unlockAudio.play().catch(e => console.log('[ReadAloud] Unlock play caught:', e));
    } catch (e) {
      console.log('[ReadAloud] Audio context unlock error:', e);
    }
    
    await tryCartesiaTTS();
  };`;
content = content.replace(triggerStr, newTriggerStr);

// 2. Add diagnostic logs to chunk playing
const playStr = `        const audio = new Audio();
        audio.playbackRate = playbackRate;
        audio.src = chunk.audioUrl;
        audioRef.current = audio;`;

const newPlayStr = `        const audio = new Audio();
        audio.playbackRate = playbackRate;
        audio.src = chunk.audioUrl;
        audioRef.current = audio;
        
        console.log('[ReadAloud] Audio element created – src length:', chunk.audioUrl?.length);`;
content = content.replace(playStr, newPlayStr);

const audioEventsStr = `        audio.onplay = () => {
           logInfo(\`Chunk \${i} started playing.\`);`;

const newAudioEventsStr = `        audio.onplay = () => {
           console.log('[ReadAloud] Audio playing');
           logInfo(\`Chunk \${i} started playing.\`);`;
content = content.replace(audioEventsStr, newAudioEventsStr);

const audioPauseStr = `        audio.onpause = () => {
           logInfo(\`Chunk \${i} paused.\`);`;
const newAudioPauseStr = `        audio.onpause = () => {
           console.log('[ReadAloud] Audio paused');
           logInfo(\`Chunk \${i} paused.\`);`;
content = content.replace(audioPauseStr, newAudioPauseStr);

const audioEndedStr = `        audio.onended = () => {
           logInfo(\`Chunk \${i} ended natively.\`);`;
const newAudioEndedStr = `        audio.onended = () => {
           console.log('[ReadAloud] Audio ended');
           logInfo(\`Chunk \${i} ended natively.\`);`;
content = content.replace(audioEndedStr, newAudioEndedStr);

const audioErrorStr = `        audio.onerror = (e) => {
          logError(\`Chunk \${i} audio element error\`, e);`;
const newAudioErrorStr = `        audio.onerror = (e) => {
          console.error('[ReadAloud] Audio error:', audio.error?.code, audio.error?.message);
          logError(\`Chunk \${i} audio element error\`, e);`;
content = content.replace(audioErrorStr, newAudioErrorStr);

// 3. Fallback logic for audio.play()
const playCatchStr = `        try {
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
        }`;

const newPlayCatchStr = `        try {
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
        }`;
content = content.replace(playCatchStr, newPlayCatchStr);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
