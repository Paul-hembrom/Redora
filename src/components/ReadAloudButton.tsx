import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Square, Loader2, AudioLines, Info } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
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


export function SmartReadAloudButton({ text, className, iconSizeClasses = "w-4 h-4", containerRef, idPrefix = "tts-sentence-" }: Props) {
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

  const tryElevenLabsTTS = async () => {
    logInfo('Triggered: Attempting ElevenLabs TTS API call...');
    try {
      setIsLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/tts/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, highQuality })
      });
      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
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
        audio.playbackRate = 0.8;
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
        
        const sentenceEl = document.getElementById(`${idPrefix}${i}`);
        console.log(`Scrolling to ${idPrefix}${i}`, 'found:', !!sentenceEl);
        if (sentenceEl) {
           sentenceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
           console.warn(`Scroll target not found: ${idPrefix}${i}`);
        }

        if (!chunk.audioUrl) {
          logWarning(`Chunk ${i} missing audioUrl, using browser TTS for this sentence.`);
          const utterance = new SpeechSynthesisUtterance(chunk.text);
          const voices = window.speechSynthesis.getVoices();
          const englishVoice = voices.find(v => v.lang.toLowerCase().includes('en') && v.localService) || voices[0];
          if (englishVoice) {
            utterance.voice = englishVoice;
          }
          utterance.rate = 0.8;
          utterance.onend = () => {
            i++;
            playNextChunk();
          };
          utterance.onerror = () => {
            i++;
            playNextChunk(); // skip this chunk if browser tts fails
          };
          window.speechSynthesis.speak(utterance);
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
            highlightOverlay.className = 'absolute pointer-events-none bg-yellow-400/30 dark:bg-yellow-200/20 rounded z-[100] transition-all duration-75 ease-linear';
            document.body.appendChild(highlightOverlay);
        }
        
        const ranges: (Range | null)[] = [];
        if (chunk.timestamps && chunk.timestamps.length > 0 && sentenceEl) {
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
        
        const updateHighlights = () => {
           if (audio !== audioRef.current || stopIntentRef.current || audio.paused || audio.ended) {
               if (highlightOverlay) highlightOverlay.style.opacity = '0';
               return;
           }
           const currentTime = audio.currentTime;
           let activeRange = null;
           if (chunk.timestamps && chunk.timestamps.length > 0) {
               for (let k = 0; k < chunk.timestamps.length; k++) {
                   const ts = chunk.timestamps[k];
                   if (currentTime >= ts.start && currentTime <= ts.end) {
                       activeRange = ranges[k];
                       break;
                   }
               }
           }
           if (activeRange && highlightOverlay) {
               const rect = activeRange.getBoundingClientRect();
               highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
               highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
               highlightOverlay.style.width = `${rect.width}px`;
               highlightOverlay.style.height = `${rect.height}px`;
               highlightOverlay.style.opacity = '1';
           } else if (highlightOverlay) {
               highlightOverlay.style.opacity = '0';
           }
           requestAnimationFrame(updateHighlights);
        };
        
        audio.onplay = () => requestAnimationFrame(updateHighlights);
        
        audio.onended = () => {
          i++;
          playNextChunk();
        };
        
        audio.onerror = () => {
          setIsPlaying(false);
          if (!stopIntentRef.current) speakWithBrowser();
        };
        
        try {
          audio.playbackRate = 0.8;
        await audio.play();
        } catch (e) {
          setIsPlaying(false);
          if (!stopIntentRef.current) speakWithBrowser();
        }
      };
      
      playNextChunk();
      logSuccess('ElevenLabs TTS API call successful, starting chunk playback.');
    } catch (err) {
      logError('ElevenLabs TTS API call failed:', err);
      setIsLoading(false);
      setIsPlaying(false);
      
      speakWithBrowser();
    }
  };

  const speakWithBrowser = () => {
    logWarning('Falling back to local browser SpeechSynthesis engine...');
    if (!('speechSynthesis' in window)) {
      logError('SpeechSynthesis engine is not supported by this browser.');
      showError('Audio playback not available.');
      return;
    }
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    if (voices.length === 0) {
      logError('TTS Failed: No local voices available at time of speak request.');
      setVoicesAvailable(false);
      setShowPermissionWarning(true);
      setTimeout(() => setShowPermissionWarning(false), 5000);
      showError('Audio playback not available.');
      return;
    }

    const englishVoice = voices.find(v => v.lang.toLowerCase().includes('en') && v.localService) || voices[0];
    if (englishVoice) {
      utterance.voice = englishVoice;
      logSuccess(`Selected local voice: ${englishVoice.name} (${englishVoice.lang})`);
    } else {
      logInfo('Selected local voice: Default system voice');
    }
    
    utterance.rate = 0.8;
    let didEnd = false;
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => {
      didEnd = true;
      setIsPlaying(false);
    };
    utterance.onerror = (e) => {
      logError('SpeechSynthesis API threw an error:', e);
      setIsPlaying(false);
      if (!stopIntentRef.current) {
        showError('Audio playback not available.');
      }
    };
    
    utteranceRef.current = utterance;
    
    try {
      window.speechSynthesis.speak(utterance);
      logInfo('Called window.speechSynthesis.speak() command.');
    } catch (err) {
      logError('Caught exception when calling speak():', err);
      showError('Audio playback not available.');
      return;
    }
    
    setIsPlaying(true); 
    
    setTimeout(() => {
      if (stopIntentRef.current || didEnd) return;
      if (!window.speechSynthesis.speaking) {
         logWarning('Timeout check: speaking flag is still false after 2 seconds. Triggering failure.');
         window.speechSynthesis.cancel();
         showError('Audio playback not available.');
      } else {
         logSuccess('Timeout check: confirmed local synthesis is successfully speaking.');
      }
    }, 2000);
  };

  const triggerSpeech = async () => {
    if (isPlaying || isLoading) {
      stopPlaying();
      return;
    }

    stopIntentRef.current = false;
    await tryElevenLabsTTS();
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
