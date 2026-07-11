import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Square, Loader2, AudioLines, Info } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  text: string;
  className?: string;
  iconSizeClasses?: string;
  containerRef?: React.RefObject<HTMLElement> | null;
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



const getSentenceElement = (container: HTMLElement, sentence: string): HTMLElement | null => {
  const cleanSentence = sentence.replace(/\s+/g, ' ').trim();
  if (!cleanSentence) return null;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let fullText = "";
  const nodes: { node: Node, start: number, end: number }[] = [];
  
  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue || "";
    nodes.push({ node, start: fullText.length, end: fullText.length + text.length });
    fullText += text;
  }
  
  let matchIndex = fullText.replace(/\s+/g, ' ').indexOf(cleanSentence);
  if (matchIndex === -1) {
    const shortSearch = cleanSentence.substring(0, 15);
    matchIndex = fullText.replace(/\s+/g, ' ').indexOf(shortSearch);
  }
  
  if (matchIndex !== -1) {
    let realIndex = 0;
    let cleanIndex = 0;
    for (let i = 0; i < fullText.length; i++) {
      if (cleanIndex === matchIndex) {
        realIndex = i;
        break;
      }
      const isSpace = /\s/.test(fullText[i]);
      if (isSpace) {
         if (i === 0 || !/\s/.test(fullText[i-1])) {
            cleanIndex++;
         }
      } else {
         cleanIndex++;
      }
    }
    
    for (const n of nodes) {
      if (realIndex >= n.start && realIndex < n.end) {
        return n.node.parentElement;
      }
    }
  }

  return null;
};

const splitIntoSentences = (text: string) => {
  const regex = /([^.!?]+[.!?]+)\s*/g;
  let sentences = [];
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match[1].trim()) {
      sentences.push(match[1].trim());
    }
    lastIndex = regex.lastIndex;
  }
  const remaining = text.substring(lastIndex).trim();
  if (remaining) {
    sentences.push(remaining);
  }
  return sentences;
};

export function SmartReadAloudButton({ text, className, iconSizeClasses = "w-4 h-4", containerRef }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [voicesAvailable, setVoicesAvailable] = useState(true);
  const [showPermissionWarning, setShowPermissionWarning] = useState(false);
  
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
    };
  }, []);

  const getContainer = (): HTMLElement => {
    let container = containerRef?.current;
    if (!container && buttonRef.current) {
      container = buttonRef.current.closest('.prose, .content, .reader, .markdown-body, .scroll-container') as HTMLElement;
    }
    if (!container) {
      // Fallback: look for the document reader or standard prose element
      container = (document.querySelector('.reader-content') || document.querySelector('.prose') || document.querySelector('.markdown-body') || document.body) as HTMLElement;
    }
    return container;
  };

  const stopPlaying = () => {
    const container = getContainer();
    if (container) {
      container.querySelectorAll('[data-sentence-index]').forEach(el => el.classList.remove('bg-cyan-500/20', 'text-cyan-300'));
    }
    stopIntentRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setProgress(0);
    setIsLoading(false);
  };

  const playQueue = async (chunks: any[], sentences: string[], currentSentenceIndex: number = 0, totalChunks: number = chunks.length) => {
    if (stopIntentRef.current || chunks.length === 0) {
      setIsPlaying(false);
      return;
    }
    const currentChunk = chunks.shift();
    setProgress(Math.round(((currentSentenceIndex + 1) / totalChunks) * 100));
    const currentSentence = sentences.shift();
    
    // Auto-scroll
    try {
        const container = getContainer();
        if (container && currentSentence) {
            // Find all matching active sentences across the page just in case, but scope to container
            const allElements = container.querySelectorAll('[data-sentence-index]');
            allElements.forEach(el => el.classList.remove('bg-cyan-500/20', 'text-cyan-300'));
            
            const targetEl = container.querySelector(`[data-sentence-index="${currentSentenceIndex}"]`);
            if (targetEl) {
                targetEl.classList.add('bg-cyan-500/20', 'text-cyan-300');
                
                // Determine the scrollable parent to scroll instead of just using scrollIntoView, which might fail or over-scroll
                // But scrollIntoView with smooth/center/nearest is standard.
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
        }
    } catch(e) { console.error("Scroll error", e); }

    const audio = new Audio(currentChunk.audioUrl);
    audioRef.current = audio;
    
    let nextAudio = null;
    if (chunks.length > 0) {
      nextAudio = new Audio(chunks[0].audioUrl);
      nextAudio.preload = 'auto';
    }

    audio.onended = () => {
      if (!stopIntentRef.current) {
        playQueue(chunks, sentences, currentSentenceIndex + 1, totalChunks);
      }
    };
    audio.onerror = () => {
      setIsPlaying(false);
      logError('ElevenLabs chunk audio element threw a playback error.');
      speakWithBrowser();
    };

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      setIsPlaying(false);
      logError('ElevenLabs chunk playback failed:', err);
    }
  };

  const tryElevenLabsTTS = async () => {
    logInfo('Triggered: Attempting ElevenLabs TTS API call...');
    try {
      setIsLoading(true);
      setProgress(0);
      setErrorMsg('');
      const res = await fetch('/api/tts/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }
      const data = await res.json();
      if (!data.chunks || data.chunks.length === 0) throw new Error('No audio chunks returned');
      
      setIsLoading(false);
      stopIntentRef.current = false;
      playQueue(data.chunks, splitIntoSentences(text));
      
      logSuccess('ElevenLabs TTS API call successful, chunk queue started.');
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
    <div className="relative inline-flex items-center gap-0.5">
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
            {progress > 0 && <span className="text-[10px] font-mono text-cyan-400 absolute -bottom-4">{progress}%</span>}
            <AudioLines className={cn("animate-pulse text-cyan-400", iconSizeClasses)} />
            <Square className="w-2.5 h-2.5 fill-current opacity-70" />
          </div>
        ) : (
          <Volume2 className={iconSizeClasses} />
        )}
      </button>

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
