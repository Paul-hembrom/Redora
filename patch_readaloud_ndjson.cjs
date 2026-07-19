const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const oldTryElevenLabsTTS = `      if (!res.ok) {
        throw new Error(\`API returned \${res.status}\`);
      }
      const data = await res.json();
      
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => {
          setIsPlaying(false);
          logError('ElevenLabs audio element threw a playback error.');
          speakWithBrowser();
        };
        audio.playbackRate = playbackRate;
        await audio.play();
        setIsLoading(false);
        setIsPlaying(true);
        logSuccess('ElevenLabs TTS API call successful, audio is playing.');
        return;
      }

      if (!data.chunks || !Array.isArray(data.chunks) || data.chunks.length === 0) {
        throw new Error('No audio chunks returned');
      }

      const chunks = data.chunks.sort((a: any, b: any) => a.index - b.index);
      
      setIsLoading(false);
      setIsPlaying(true);
      
      let i = 0;
      
      const playNextChunk = async () => {
        if (stopIntentRef.current || i >= chunks.length) {
          setIsPlaying(false);
          return;
        }
        
        const chunk = chunks[i];
`;

const newTryElevenLabsTTS = `      if (!res.ok || !res.body) {
        throw new Error(\`API returned \${res.status}\`);
      }
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      let totalChunks = 0;
      const chunks: any[] = [];
      let i = 0;
      let streamEnded = false;
      let isPlayingNext = false;
      
      setIsLoading(false);
      setIsPlaying(true);
      
      const playNextChunk = async () => {
        if (stopIntentRef.current) {
          setIsPlaying(false);
          return;
        }
        if (totalChunks > 0 && i >= totalChunks) {
          setIsPlaying(false);
          return;
        }
        if (streamEnded && !chunks[i]) {
          setIsPlaying(false);
          return;
        }
        
        const chunk = chunks[i];
        if (!chunk) {
          // Chunk not ready yet, it will be triggered by read loop
          return;
        }
        
        isPlayingNext = true;
`;

code = code.replace(oldTryElevenLabsTTS, newTryElevenLabsTTS);

const oldOnEnded = `        audio.onended = () => {
          i++;
          playNextChunk();
        };
        
        audio.onerror = () => {
          setIsPlaying(false);
          if (!stopIntentRef.current) speakWithBrowser();
        };
        
        try {
          audio.playbackRate = playbackRate;
        await audio.play();
        } catch (e) {
          setIsPlaying(false);
          if (!stopIntentRef.current) speakWithBrowser();
        }
      };
      
      playNextChunk();
      logSuccess('ElevenLabs TTS API call successful, starting chunk playback.');`;

const newOnEnded = `        audio.onended = () => {
          i++;
          isPlayingNext = false;
          playNextChunk();
        };
        
        audio.onerror = () => {
          setIsPlaying(false);
          if (!stopIntentRef.current) speakWithBrowser();
        };
        
        try {
          audio.playbackRate = playbackRate;
          // Small offset for the first chunk to align highlighting with audio start
          if (i === 0) {
            setTimeout(() => {
              if (!audio.paused) requestAnimationFrame(updateHighlights);
            }, 100);
            audio.onplay = null; // Prevent the default onplay from firing immediately
          }
          await audio.play();
        } catch (e) {
          setIsPlaying(false);
          if (!stopIntentRef.current) speakWithBrowser();
        }
      };
      
      // Start reading the stream
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
                  if (totalChunks === 0) {
                    throw new Error('No audio chunks returned');
                  }
                } else if (data.index !== undefined) {
                  chunks[data.index] = data;
                  if (i === data.index && !isPlayingNext) {
                    playNextChunk();
                  }
                }
              }
            }
          }
          if (buffer.trim()) {
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
          }
        } catch (err) {
          logError('Stream reading error:', err);
          if (!isPlayingNext) {
            setIsPlaying(false);
            speakWithBrowser();
          }
        }
      })();
      
      logSuccess('ElevenLabs TTS API call successful, starting chunk playback.');`;

code = code.replace(oldOnEnded, newOnEnded);

// In playNextChunk, there is `utterance.onend = ...`
const oldUtteranceOnEnded = `          utterance.onend = () => {
            i++;
            playNextChunk();
          };
          utterance.onerror = () => {
            i++;
            playNextChunk(); // skip this chunk if browser tts fails
          };
          window.speechSynthesis.speak(utterance);
          return;
        }`;

const newUtteranceOnEnded = `          utterance.onend = () => {
            i++;
            isPlayingNext = false;
            playNextChunk();
          };
          utterance.onerror = () => {
            i++;
            isPlayingNext = false;
            playNextChunk(); // skip this chunk if browser tts fails
          };
          window.speechSynthesis.speak(utterance);
          return;
        }`;

code = code.replace(oldUtteranceOnEnded, newUtteranceOnEnded);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log('patched readaloud');
