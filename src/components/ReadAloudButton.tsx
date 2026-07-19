import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Square, Loader2, AudioLines, Info } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  playbackRate?: number;
  text: string;
  className?: string;
  iconSizeClasses?: string;
  containerRef?: React.RefObject<HTMLElement | null> | HTMLElement | null;
  idPrefix?: string;
}


const logInfo = (msg: string, data?: any) => {
  console.log('%c[SmartReadAloud]', 'color: #0ea5e9; font-weight: bold; background: #0ea5e91a; padding: 2px 6px; border-radius: 4px;', msg, data || '');
};

const logSuccess = (msg: string, data?: any) => {
  console.log('%c[SmartReadAloud]', 'color: #10b981; font-weight: bold; background: #10b9811a; padding: 2px 6px; border-radius: 4px;', msg, data || '');
};

const logWarning = (msg: string, data?: any) => {
  console.warn('%c[SmartReadAloud]', 'color: #f59e0b; font-weight: bold; background: #f59e0b1a; padding: 2px 6px; border-radius: 4px;', msg, data || '');
};

const logError = (msg: string, data?: any) => {
  console.error('%c[SmartReadAloud]', 'color: #ef4444; font-weight: bold; background: #ef44441a; padding: 2px 6px; border-radius: 4px;', msg, data || '');
};


export function SmartReadAloudButton({ text, className, iconSizeClasses = "w-4 h-4", containerRef, idPrefix = "tts-sentence-", playbackRate = 0.8 }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [voicesAvailable, setVoicesAvailable] = useState(true);
  const [showPermissionWarning, setShowPermissionWarning] = useState(false);
  const [highQuality, setHighQuality] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const stopIntentRef = useRef(false);

  useEffect(() => {
    return () => stopPlaying();
  }, []);

  useEffect(() => {
    const checkVoices = () => {
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        
        const logVoices = (vList: SpeechSynthesisVoice[]) => {
          logSuccess(`Found ${vList.length} voices loaded.`);
          if (vList.length > 0) {
            logInfo(`Available voice languages: ${Array.from(new Set(vList.map(v => v.lang))).join(', ')}`);
          }
        };

        if (voices.length === 0) {
          logInfo('No voices initially. Listening for voiceschanged event...');
          const handleVoicesChanged = () => {
            const updatedVoices = window.speechSynthesis.getVoices();
            logVoices(updatedVoices);
            setVoicesAvailable(updatedVoices.length > 0);
          };
          window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
          return () => window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        } else {
          logVoices(voices);
          setVoicesAvailable(true);
        }
      } else {
        logError('speechSynthesis API not found in this browser.');
        setVoicesAvailable(false);
      }
    };
    
    const cleanupVoices = checkVoices();
    
    const handleFocus = () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      if (cleanupVoices) cleanupVoices();
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    fetch('/api/tts/stream/prewarm', { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleInteraction = () => {
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    };
    window.addEventListener('touchstart', handleInteraction, { once: true, passive: true });
    window.addEventListener('click', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      const highlightOverlay = document.getElementById('tts-highlight-overlay');
      if (highlightOverlay) highlightOverlay.style.opacity = '0';
    };
  }, []);

  const stopPlaying = () => {
    stopIntentRef.current = true;
    const highlightOverlay = document.getElementById('tts-highlight-overlay');
    if (highlightOverlay) highlightOverlay.style.opacity = '0';
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsLoading(false);
  };

  const tryCartesiaTTS = async () => {
    logInfo('Triggered: Attempting ElevenLabs TTS API call...');
    try {
      setIsLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/tts/cartesia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, highQuality })
      });
      if (!res.ok || !res.body) {
        throw new Error(`API returned ${res.status}`);
      }
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      let totalChunks = 0;
      const chunks: any[] = [];
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

        isPlayingNext = true;

        const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
        const sentenceEl = document.getElementById(`${idPrefix}${domIndex}`);
        console.log(`Scrolling to ${idPrefix}${domIndex}`, 'found:', !!sentenceEl);
        if (sentenceEl) {
           sentenceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
           console.warn(`Scroll target not found: ${idPrefix}${i}`);
        }
        
        if (!chunk.audioUrl) {
          logWarning(`Chunk ${i} missing audioUrl.`);
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
        }

        const audio = new Audio(chunk.audioUrl);
        audioRef.current = audio;

        if (i + 1 < chunks.length && chunks[i+1].audioUrl) {
          const nextAudio = new Audio(chunks[i+1].audioUrl);
          nextAudio.preload = "auto";
        }

        let highlightOverlay = document.getElementById('tts-highlight-overlay');
        if (!highlightOverlay) {
            highlightOverlay = document.createElement('div');
            highlightOverlay.id = 'tts-highlight-overlay';
            highlightOverlay.className = 'absolute pointer-events-none bg-amber-400/70 rounded z-[100] transition-all duration-75 ease-linear';
            document.body.appendChild(highlightOverlay);
        }

        const ranges: (Range | null)[] = [];
        let shouldHighlight = true;

        // Guard: Check if the text matches (to avoid erratic highlighting if chunks don't align)
        // Safety check: If the chunk text (sentence) doesn't perfectly match what we expect in the frontend block, 
        // skip word highlighting for this chunk entirely (block-level scrolling still works).
        if (sentenceEl && chunk.text) {
           const domText = sentenceEl.textContent || '';
           if (domText.indexOf(chunk.text) === -1 && domText.toLowerCase().indexOf(chunk.text.toLowerCase()) === -1) {
               console.warn(`Highlighting disabled for chunk ${i} because chunk text not found in DOM block`);
               shouldHighlight = false;
           }
        }

        if (shouldHighlight && chunk.timestamps && chunk.timestamps.length > 0 && sentenceEl) {
            const walker = document.createTreeWalker(sentenceEl, NodeFilter.SHOW_TEXT, null);
            const textNodes = [];
            let node;
            while ((node = walker.nextNode())) {
                textNodes.push(node);
            }

            let fullText = "";
            const indexMap: {node: Node, offset: number}[] = [];
            for (const tNode of textNodes) {
                const txt = tNode.nodeValue || "";
                for (let k = 0; k < txt.length; k++) {
                    indexMap.push({ node: tNode, offset: k });
                }
                fullText += txt;
            }

            let searchIndex = 0;
            let chunkOffset = fullText.indexOf(chunk.text);
            if (chunkOffset === -1) chunkOffset = fullText.toLowerCase().indexOf(chunk.text.toLowerCase());
            if (chunkOffset !== -1) {
                searchIndex = chunkOffset;
            }

            for (const ts of chunk.timestamps) {
                const word = ts.word ? ts.word.trim() : "";
                if (!word) {
                    ranges.push(null);
                    continue;
                }
                let matchIdx = fullText.indexOf(word, searchIndex);
                if (matchIdx === -1) {
                    matchIdx = fullText.toLowerCase().indexOf(word.toLowerCase(), searchIndex);
                }
                if (matchIdx !== -1) {
                    const startNodeInfo = indexMap[matchIdx];
                    const endNodeInfo = indexMap[matchIdx + word.length - 1];
                    if (startNodeInfo && endNodeInfo) {
                        const range = document.createRange();
                        range.setStart(startNodeInfo.node, startNodeInfo.offset);
                        range.setEnd(endNodeInfo.node, endNodeInfo.offset + 1);
                        ranges.push(range);
                    } else {
                        ranges.push(null);
                    }
                    searchIndex = matchIdx + word.length;
                } else {
                    ranges.push(null);
                }
            }
        }

        let highlightTimeouts: NodeJS.Timeout[] = [];
        const clearHighlightTimeouts = () => {
            highlightTimeouts.forEach(clearTimeout);
            highlightTimeouts = [];
        };
        
        audio.onplay = () => {
           logInfo(`Chunk ${i} started playing.`);
           if (!chunk.timestamps || stopIntentRef.current) return;
           
           // Use setTimeout relative to audio currentTime to schedule highlights
           chunk.timestamps.forEach((ts: any, k: number) => {
               const activeRange = ranges[k];
               if (!activeRange || !highlightOverlay) return;
               
               const start_time = ts.start_time !== undefined ? ts.start_time : ts.start;
               const end_time = ts.end_time !== undefined ? ts.end_time : ts.end;
               
               // Calculate delay considering current playback time and playback rate
               let startDelay = Math.max(0, (start_time - audio.currentTime)) * 1000 / playbackRate;
               let endDelay = Math.max(0, (end_time - audio.currentTime)) * 1000 / playbackRate;
               
               // Apply 150ms offset for the very first chunk to compensate for encoder delay
               if (i === 0) {
                   startDelay += 150;
                   endDelay += 150;
               }
               
               const startTimer = setTimeout(() => {
                   if (stopIntentRef.current || audio !== audioRef.current || audio.paused) return;
                   const rect = activeRange.getBoundingClientRect();
                   highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
                   highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
                   highlightOverlay.style.width = `${rect.width}px`;
                   highlightOverlay.style.height = `${rect.height}px`;
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
        
        audio.onpause = () => {
           logInfo(`Chunk ${i} paused.`);
           clearHighlightTimeouts();
        };
        
        audio.onended = () => {
           logInfo(`Chunk ${i} ended.`);
           clearHighlightTimeouts();
           i++;
           isPlayingNext = false;
           playNextChunk();
        };
        
        audio.onerror = (e) => {
          logError(`Chunk ${i} audio element error`, e);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
          } else {
             i++;
             isPlayingNext = false;
             playNextChunk();
          }
        };

        try {
          audio.playbackRate = playbackRate;
          await audio.play();
          playedChunks++;
        } catch (e) {
          logError(`Chunk ${i} audio play threw error`, e);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
          } else {
             i++;
             isPlayingNext = false;
             playNextChunk();
          }
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
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.trim()) {
                const data = JSON.parse(line);
                if (data.totalChunks !== undefined) {
                  totalChunks = data.totalChunks;
                  logInfo(`Received totalChunks: ${totalChunks}`);
                  if (totalChunks === 0) {
                    throw new Error('No audio chunks returned');
                  }
                  const expectedElements = document.querySelectorAll(`[id^="${idPrefix}"]`).length;
                  if (expectedElements > 0 && totalChunks !== expectedElements) {
                    logWarning(`Mismatch: expected ${expectedElements} DOM elements but got ${totalChunks} audio chunks. Falling back to whole-text playback (disabling sync).`);
                    disableSync = true;
                  }

                } else if (data.index !== undefined) {
                  chunks[data.index] = data;
                  const isValid = data.audioUrl && data.audioUrl.startsWith('data:audio/');
                  logInfo(`Received chunk ${data.index}. Audio URL valid: ${!!isValid}`);
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
            showError('Audio unavailable for this content. Please try again later.');
          }
        }
      })();
      
      logSuccess('Cartesia TTS API call successful, starting chunk playback.');
    } catch (err) {
      logError('Cartesia TTS API call failed:', err);
      setIsLoading(false);
      setIsPlaying(false);
      
      showError('Audio unavailable for this content. Please try again later.');
    }
  };


  const triggerSpeech = async () => {
    if (isPlaying || isLoading) {
      stopPlaying();
      return;
    }

    stopIntentRef.current = false;
    await tryCartesiaTTS();
  };

  useEffect(() => {
    const btn = buttonRef.current;
    if (!btn) return;

    const handleTouchStart = (e: TouchEvent) => {
      logInfo("Trigger Event: touchstart detected on ReadAloudButton");
      e.preventDefault(); 
      triggerSpeech();
    };

    const handleClick = (e: MouseEvent) => {
      logInfo("Trigger Event: click detected on ReadAloudButton");
      e.preventDefault();
      triggerSpeech();
    };

    btn.addEventListener('click', handleClick);
    btn.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      btn.removeEventListener('click', handleClick);
      btn.removeEventListener('touchstart', handleTouchStart);
    };
  }, [text, isPlaying, isLoading, voicesAvailable]); 

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => {
      setErrorMsg('');
    }, 3000);
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      <button 
        ref={buttonRef}
        className={cn(
          "relative p-1.5 bg-black/20 hover:bg-black/40 rounded text-white/50 hover:text-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center touch-manipulation z-10",
          "before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:min-w-[48px] before:min-h-[48px] before:content-['']",
          isPlaying && "text-cyan-400 bg-black/40",
          className
        )}
        title={isPlaying ? "Stop Reading" : "Read Aloud"}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className={cn("animate-spin", iconSizeClasses)} />
        ) : isPlaying ? (
          <div className="flex items-center gap-1">
            <AudioLines className={cn("animate-pulse text-cyan-400", iconSizeClasses)} />
            <Square className="w-2.5 h-2.5 fill-current opacity-70" />
          </div>
        ) : (
          <Volume2 className={iconSizeClasses} />
        )}
      </button>
      
      {!isPlaying && !isLoading && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setHighQuality(!highQuality);
          }}
          className={cn(
            "text-[10px] font-mono px-1 rounded transition-colors z-10 hidden sm:block",
            highQuality ? "bg-cyan-900/50 text-cyan-400" : "bg-black/20 text-white/30 hover:text-white/50"
          )}
          title="Toggle High Quality (Slower)"
        >
          HQ
        </button>
      )}

      {errorMsg && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-500 text-white text-xs px-2 py-1 rounded select-none pointer-events-none z-50 shadow-xl border border-red-400/30">
          {errorMsg}
        </div>
      )}

      {showPermissionWarning && (
        <div className="absolute bottom-full mb-3 right-0 w-[240px] bg-gray-800 text-gray-200 text-xs p-3 rounded-lg shadow-xl border border-white/10 flex items-start gap-2 z-50">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-medium text-white">No voices found.</span>
            <span className="text-[11px] text-gray-400 leading-tight">
              Check Chrome site sound settings (Settings → Site Settings → Sound → Allow).
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export { SmartReadAloudButton as ReadAloudButton };
