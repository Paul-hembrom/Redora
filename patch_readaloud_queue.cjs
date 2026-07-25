const fs = require('fs');
const content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const targetFunctionStart = content.indexOf('const tryCartesiaTTS = async () => {');
if (targetFunctionStart === -1) {
    console.error("Could not find tryCartesiaTTS");
    process.exit(1);
}

// We need to replace everything from `const tryCartesiaTTS = async () => {`
// down to its closing bracket.
// Let's find the closing bracket of `tryCartesiaTTS`.
let openBraces = 0;
let started = false;
let targetFunctionEnd = -1;
for (let i = targetFunctionStart; i < content.length; i++) {
    if (content[i] === '{') {
        openBraces++;
        started = true;
    } else if (content[i] === '}') {
        openBraces--;
        if (started && openBraces === 0) {
            targetFunctionEnd = i;
            break;
        }
    }
}

if (targetFunctionEnd === -1) {
    console.error("Could not find end of tryCartesiaTTS");
    process.exit(1);
}

const newTryCartesiaTTS = `const tryCartesiaTTS = async () => {
    try {
      setIsLoading(true);
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }

      const scopeRoot = getScopeRoot();
      const sentenceTextNodes = scopeRoot.querySelectorAll(\`[id^="\${idPrefix}"]\`);
      const allText = Array.from(sentenceTextNodes)
          .map(node => node.textContent)
          .join(" ");
          
      let finalDocText = documentText || allText;
      if (!finalDocText) {
          const mainContent = document.querySelector('article') || document.querySelector('main');
          finalDocText = mainContent ? mainContent.textContent || "" : document.body.textContent || "";
      }

      const res = await fetch('/api/tts/cartesia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: finalDocText })
      });

      if (!res.ok || !res.body) {
        throw new Error('Cartesia API request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let totalChunks = 0;
      let expectedIndex = 0;
      let streamEnded = false;
      let disableSync = false;
      let failedChunks = 0;
      let playedChunks = 0;
      
      const chunksMap = new Map<number, any>();
      const audioQueue: any[] = [];
      let isQueuePlaying = false;

      setIsLoading(false);
      setIsPlaying(true);

      const playNext = async () => {
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

        const i = chunk.index;
        const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
        const scopeRoot = getScopeRoot();
        let sentenceEl = scopeRoot.querySelector(\`[id="\${idPrefix}\${domIndex}"]\`) as HTMLElement | null;
        if (!sentenceEl && idPrefix.startsWith("tts-explanation-")) {
            sentenceEl = scopeRoot.querySelector(\`[id="\${idPrefix}0"]\`) as HTMLElement | null;
        }
        if (!sentenceEl) {
            sentenceEl = document.getElementById(\`tts-sentence-\${i}\`) as HTMLElement | null;
        }
        if (!sentenceEl && buttonRef.current) {
            const bubble = buttonRef.current.closest('.group\\\\/bubble');
            if (bubble) {
                sentenceEl = bubble.querySelector('.prose') as HTMLElement | null;
            }
        }

        if (!chunk.audioUrl) {
          logWarning(\`Chunk \${i} missing audioUrl.\`);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
             isQueuePlaying = false;
             return;
          }
          playNext();
          return;
        }

        const audio = new Audio();
        audio.playbackRate = playbackRate;
        audio.src = chunk.audioUrl;
        audioRef.current = audio;

        let wordSpans: HTMLElement[] = [];
        if (!disableSync && sentenceEl && chunk.timestamps) {
            wordSpans = Array.from(sentenceEl.querySelectorAll('span[id^="tts-word-"]')) as HTMLElement[];
        }

        const removeHighlights = () => {
            wordSpans.forEach(span => span.classList.remove('bg-amber-400/70'));
            if (sentenceEl) {
                const words = Array.from(sentenceEl.querySelectorAll('span[id^="tts-word-"]'));
                words.forEach(w => w.classList.remove('bg-amber-400/70'));
            }
        };

        let hasScrolled = false;
        let animationFrameId: number;

        const highlightLoop = () => {
            if (stopIntentRef.current || audio.paused || audio.ended) return;

            const currentTime = audio.currentTime;
            
            if (currentTime > 0.05 && !hasScrolled) {
               hasScrolled = true;
               if (sentenceEl) {
                 sentenceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
               } else {
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
           if (!chunk.timestamps || stopIntentRef.current) return;
           animationFrameId = requestAnimationFrame(highlightLoop);
        };

        audio.onpause = () => {
           logInfo(\`Chunk \${i} paused.\`);
           cancelAnimationFrame(animationFrameId);
           removeHighlights();
        };

        audio.onended = () => {
           logInfo(\`Chunk \${i} ended natively.\`);
           cancelAnimationFrame(animationFrameId);
           removeHighlights();
           playNext();
        };

        audio.onerror = (e) => {
          logError(\`Chunk \${i} audio element error\`, e);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
             isQueuePlaying = false;
          } else {
             playNext();
          }
        };

        try {
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
             playNext();
          }
        }
      };

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              streamEnded = true;
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                const data = JSON.parse(line);
                if (data.totalChunks !== undefined) {
                  totalChunks = data.totalChunks;
                  logInfo(\`Received totalChunks: \${totalChunks}\`);
                  if (totalChunks === 0) {
                    throw new Error('No audio chunks returned');
                  }
                  const scopeRoot = getScopeRoot();
                  const expectedElements = scopeRoot.querySelectorAll(\`[id^="\${idPrefix}"]\`).length;
                  const fallbackElements = document.querySelectorAll('[id^="tts-sentence-"]').length;
                  if (expectedElements === 0 && fallbackElements === 0 && !idPrefix.startsWith("tts-explanation-")) {
                    const bubble = buttonRef.current?.closest('.group\\\\/bubble');
                    if (!bubble) {
                        logWarning(\`No DOM elements found matching \${idPrefix} or fallback. Disabling sync.\`);
                        disableSync = true;
                    }
                  }
                } else if (data.index !== undefined) {
                  chunksMap.set(data.index, data);
                  
                  let addedToQueue = false;
                  while (chunksMap.has(expectedIndex)) {
                      audioQueue.push(chunksMap.get(expectedIndex));
                      chunksMap.delete(expectedIndex);
                      expectedIndex++;
                      addedToQueue = true;
                  }
                  
                  if (addedToQueue && !isQueuePlaying) {
                      playNext();
                  }
                }
              }
            }
          }
          if (buffer.trim()) {
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
                    playNext();
                }
             }
          }
          if (!isQueuePlaying && audioQueue.length > 0) {
              playNext();
          }
        } catch (err) {
          logError('Stream reading error:', err);
          if (!isQueuePlaying) {
            setIsPlaying(false);
            showError('Audio unavailable for this content. Please try again later.');
          }
        }
      })();

      logSuccess('Cartesia TTS API call successful, starting chunk playback.');
    } catch (err) {
      logError('Cartesia TTS API call failed:', err);
      setIsLoading(false);
      setIsPlaying(false);
    }
  }`;

const finalContent = content.substring(0, targetFunctionStart) + newTryCartesiaTTS + content.substring(targetFunctionEnd + 1);

fs.writeFileSync('src/components/ReadAloudButton.tsx', finalContent);
console.log('patched');
