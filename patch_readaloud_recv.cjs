const fs = require('fs');
let content = fs.readFileSync('readaloud_copy3.tsx', 'utf8');

content = content.replace(
`                } else if (data.index !== undefined) {
                  chunks[data.index] = data;
                  const isValid = data.audioUrl && data.audioUrl.startsWith('data:audio/');
                  logInfo(\`Received chunk \${data.index}. Audio URL valid: \${!!isValid}\`);
                  if (i === data.index && !isPlayingNext) {
                    playNextChunk();
                  }
                }`,
`                } else if (data.index !== undefined) {
                  const isValid = data.audioUrl && data.audioUrl.startsWith('data:audio/');
                  logInfo(\`Received chunk \${data.index}. Audio URL valid: \${!!isValid}\`);
                  chunksMap.set(data.index, data);
                  
                  let addedToQueue = false;
                  while (chunksMap.has(expectedIndex)) {
                      audioQueue.push(chunksMap.get(expectedIndex));
                      chunksMap.delete(expectedIndex);
                      expectedIndex++;
                      addedToQueue = true;
                  }
                  
                  if (addedToQueue && !isQueuePlaying) {
                      playNextChunk();
                  }
                }`
);

content = content.replace(
`          if (buffer.trim()) {
             const data = JSON.parse(buffer);
             if (data.index !== undefined) {
                chunks[data.index] = data;
                if (i === data.index && !isPlayingNext) {
                  playNextChunk();
                }
             }
          }
          if (!isPlayingNext && i < chunks.length) {
              playNextChunk();
          }`,
`          if (buffer.trim()) {
             const data = JSON.parse(buffer);
             if (data.index !== undefined) {
                chunksMap.set(data.index, data);
                let addedToQueue = false;
                while (chunksMap.has(expectedIndex)) {
                    audioQueue.push(chunksMap.get(expectedIndex));
                    chunksMap.delete(expectedIndex);
                    expectedIndex++;
                    addedToQueue = true;
                }
                if (addedToQueue && !isQueuePlaying) {
                    playNextChunk();
                }
             }
          }
          if (!isQueuePlaying && audioQueue.length > 0) {
              playNextChunk();
          }`
);

content = content.replace(
`        } catch (err) {
          logError('Stream reading error:', err);
          if (!isPlayingNext) {
            setIsPlaying(false);
            showError('Audio unavailable for this content. Please try again later.');
          }
        }`,
`        } catch (err) {
          logError('Stream reading error:', err);
          if (!isQueuePlaying) {
            setIsPlaying(false);
            showError('Audio unavailable for this content. Please try again later.');
          }
        }`
);

fs.writeFileSync('readaloud_copy4.tsx', content);
