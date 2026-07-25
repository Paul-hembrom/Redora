const fs = require('fs');
let content = fs.readFileSync('readaloud_copy.tsx', 'utf8');

content = content.replace(
`      const chunks: any[] = [];
      let i = 0;
      let streamEnded = false;
      let isPlayingNext = false;
      let disableSync = false;
      let failedChunks = 0;
      let playedChunks = 0;

      setIsLoading(false);
      setIsPlaying(true);

      const playNextChunk = async () => {
        if (stopIntentRef.current) {
          setIsPlaying(false);
          return;
        }
        if (totalChunks > 0 && i >= totalChunks) {
          if (playedChunks === 0 && failedChunks > 0) {
            showError('Audio unavailable for this content. Please try again later.');
          }
          setIsPlaying(false);
          return;
        }
        if (streamEnded && !chunks[i]) {
          if (playedChunks === 0 && failedChunks > 0) {
            showError('Audio unavailable for this content. Please try again later.');
          }
          setIsPlaying(false);
          return;
        }

        const chunk = chunks[i];
        if (!chunk) {
          // Chunk not ready yet, it will be triggered by read loop
          return;
        }

        isPlayingNext = true;`,
`      const chunksMap = new Map<number, any>();
      const audioQueue: any[] = [];
      let isQueuePlaying = false;
      let expectedIndex = 0;

      let streamEnded = false;
      let disableSync = false;
      let failedChunks = 0;
      let playedChunks = 0;

      setIsLoading(false);
      setIsPlaying(true);

      const playNextChunk = async () => {
        if (stopIntentRef.current) {
          setIsPlaying(false);
          isQueuePlaying = false;
          return;
        }

        if (audioQueue.length === 0) {
          isQueuePlaying = false;
          if (streamEnded && expectedIndex >= totalChunks) {
            if (playedChunks === 0 && failedChunks > 0) {
              showError('Audio unavailable for this content. Please try again later.');
            }
            setIsPlaying(false);
          }
          return;
        }

        isQueuePlaying = true;
        const chunk = audioQueue.shift();

        // Pre-load the next audio chunk while the current one is playing
        if (audioQueue.length > 0) {
            const nextAudio = new Audio();
            nextAudio.preload = 'auto';
            nextAudio.src = audioQueue[0].audioUrl;
        }

        const i = chunk.index;`
);

fs.writeFileSync('readaloud_copy2.tsx', content);
