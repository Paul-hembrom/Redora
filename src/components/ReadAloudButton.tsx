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
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopIntentRef = useRef(false);

  // Resolves the DOM root to search within. Falls back to `document` when no
  // containerRef is supplied, but scopes lookups to the given container/ref
  // when one is provided so multiple instances on the same page with
  // overlapping idPrefixes don't collide.
  const getScopeRoot = (): Document | HTMLElement => {
    if (!containerRef) return document;
    if (containerRef instanceof HTMLElement) return containerRef;
    return containerRef.current || document;
  };

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
          // Set the known state immediately instead of leaving it stuck at
          // the default `true` in case `voiceschanged` never fires.
          setVoicesAvailable(false);
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
    logInfo('Triggered: Attempting Cartesia TTS API call...');
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
        const scopeRoot = getScopeRoot();
        const sentenceEl = scopeRoot.querySelector(`[id="${idPrefix}${domIndex}"]`) as HTMLElement | null;

        if (!disableSync) {
          console.log(`Scrolling to ${idPrefix}${domIndex}`, 'found:', !!sentenceEl);
          if (sentenceEl) {
            sentenceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            console.warn(`Scroll target not found: ${idPrefix}${i}`);
          }
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

        // Guard against sparse-array holes: the next chunk may not have
        // arrived yet even though `chunks.length` already reflects a later
        // index (chunks can arrive out of order over the network).
        if (i + 1 < chunks.length && chunks[i + 1] && chunks[i + 1].audioUrl) {
          const nextAudio = new Audio(chunks[i + 1].audioUrl);
          nextAudio.preload = "auto";
        }

        const wordSpans: (HTMLElement | null)[] = new Array(chunk.timestamps ? chunk.timestamps.length : 0).fill(null);
        let shouldHighlight = !disableSync;

        // Remove old overlay if it exists
        const oldOverlay = document.getElementById('tts-highlight-overlay');
        if (oldOverlay) oldOverlay.remove();

        // Guard: Check if the text matches (to avoid erratic highlighting if chunks don't align)
        if (shouldHighlight && sentenceEl && chunk.text) {
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

            // Pass 1: locate every word match in the *original* (unmutated)
            // text first. We must not wrap-as-we-go here, because wrapping
            // a word splits its text node and invalidates the node/offset
            // references we've already computed for later words.
            type Match = { tsIndex: number; start: number; end: number };
            const matches: Match[] = [];
            for (let tsIdx = 0; tsIdx < chunk.timestamps.length; tsIdx++) {
                const ts = chunk.timestamps[tsIdx];
                const word = ts.word ? ts.word.trim() : "";
                if (!word) continue;

                let matchIdx = fullText.indexOf(word, searchIndex);
                if (matchIdx === -1) {
                    matchIdx = fullText.toLowerCase().indexOf(word.toLowerCase(), searchIndex);
                }

                if (matchIdx !== -1) {
                    matches.push({ tsIndex: tsIdx, start: matchIdx, end: matchIdx + word.length - 1 });
                    searchIndex = matchIdx + word.length;
                }
            }

            // Pass 2: wrap matches in *descending* start-offset order so
            // that mutating a later match's text node never invalidates the
            // node/offset references of matches earlier in the sentence
            // (splitting a node only ever affects the content after the
            // split point, never before it).
            const orderedForWrapping = [...matches].sort((a, b) => b.start - a.start);

            for (const m of orderedForWrapping) {
                const startNodeInfo = indexMap[m.start];
                const endNodeInfo = indexMap[m.end];
                if (!startNodeInfo || !endNodeInfo) continue;

                const range = document.createRange();
                range.setStart(startNodeInfo.node, startNodeInfo.offset);
                range.setEnd(endNodeInfo.node, endNodeInfo.offset + 1);

                let span: HTMLElement | null = null;
                // check if already wrapped
                if (startNodeInfo.node === endNodeInfo.node && startNodeInfo.node.parentElement && startNodeInfo.node.parentElement.classList.contains('tts-word')) {
                    span = startNodeInfo.node.parentElement;
                } else {
                    span = document.createElement('span');
                    span.className = 'tts-word transition-colors duration-100 ease-linear rounded';
                    try {
                        range.surroundContents(span);
                    } catch (e) {
                        span = null;
                    }
                }
                wordSpans[m.tsIndex] = span;
            }
        }

        const removeHighlights = () => {
            wordSpans.forEach(span => {
                if (span) span.classList.remove('bg-amber-400/70');
            });
        };

        const timeUpdateHandler = () => {
            if (stopIntentRef.current) return;
            const currentTime = audio.currentTime;

            chunk.timestamps.forEach((ts: any, k: number) => {
                const span = wordSpans[k];
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
        };

        audio.onplay = () => {
           logInfo(`Chunk ${i} started playing.`);
           if (!chunk.timestamps || stopIntentRef.current) return;
           audio.addEventListener('timeupdate', timeUpdateHandler);
        };

        audio.onpause = () => {
           logInfo(`Chunk ${i} paused.`);
           audio.removeEventListener('timeupdate', timeUpdateHandler);
           removeHighlights();
        };

        audio.onended = () => {
           logInfo(`Chunk ${i} ended.`);
           audio.removeEventListener('timeupdate', timeUpdateHandler);
           removeHighlights();
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
                  const scopeRoot = getScopeRoot();
                  const expectedElements = scopeRoot.querySelectorAll(`[id^="${idPrefix}"]`).length;
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
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMsg('');
    }, 3000);

    // Surface the permission/voices hint only when it's actually relevant:
    // playback failed entirely AND the browser has no TTS voices available.
    if (!voicesAvailable) {
      setShowPermissionWarning(true);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = setTimeout(() => {
        setShowPermissionWarning(false);
      }, 5000);
    }
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