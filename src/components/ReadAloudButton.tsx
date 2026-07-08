import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Square, Loader2, AudioLines, Settings2, Sparkles, Check, Info } from 'lucide-react';
import { synthesizeSpeech } from '../lib/gemini';
import { cn } from '../lib/utils';

interface Props {
  text: string;
  className?: string;
  iconSizeClasses?: string;
}

export function ReadAloudButton({ text, className, iconSizeClasses = "w-3 h-3" }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [usePremium, setUsePremium] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [voicesAvailable, setVoicesAvailable] = useState(true);
  const [showPermissionWarning, setShowPermissionWarning] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => stopPlaying();
  }, []);

  useEffect(() => {
    // Check for voices on mount
    const checkVoices = () => {
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
          // If empty, wait for voiceschanged to fire
          const handleVoicesChanged = () => {
            const updatedVoices = window.speechSynthesis.getVoices();
            if (updatedVoices.length === 0) {
              setVoicesAvailable(false);
            } else {
              setVoicesAvailable(true);
            }
          };
          window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
          return () => window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        } else {
          setVoicesAvailable(true);
        }
      } else {
        setVoicesAvailable(false);
      }
    };
    
    const cleanupVoices = checkVoices();
    
    // Tab-throttling recovery: cancel speech when tab gains focus
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
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };
    if (showOptions) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showOptions]);

  // Resume audio context on first interaction if suspended (gesture compliance)
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

  const stopPlaying = () => {
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

  const speakWithBrowser = (): boolean => {
    if (!('speechSynthesis' in window)) return false;
    
    window.speechSynthesis.cancel(); // Stop anything playing
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    if (voices.length === 0) {
      setVoicesAvailable(false);
      return false;
    }

    const englishVoice = voices.find(v => v.lang.includes('en') && v.localService) || voices[0];
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = (e) => {
      console.error("SpeechSynthesis error:", e);
      setIsPlaying(false);
    };
    
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    
    // Sometimes onstart doesn't fire immediately on mobile
    setIsPlaying(true); 
    
    return true;
  };

  const tryGeminiTTS = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const url = await synthesizeSpeech(text, 'Kore');
      
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        showError('Voice playback not supported on this device.');
      };
      
      setIsLoading(false);
      setIsPlaying(true);
      await audio.play();
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      setIsPlaying(false);
      showError('Voice playback not supported on this device.');
    }
  };

  const triggerSpeech = async () => {
    if (isPlaying || isLoading) {
      stopPlaying();
      return;
    }

    if (!voicesAvailable && !usePremium) {
      setShowPermissionWarning(true);
      setTimeout(() => setShowPermissionWarning(false), 5000);
      // fallback to Gemini if possible
      await tryGeminiTTS();
      return;
    }

    if (usePremium) {
      await tryGeminiTTS();
    } else {
      const started = speakWithBrowser();
      if (!started) {
        // Fallback to Gemini if browser TTS is unsupported
        await tryGeminiTTS();
      }
    }
  };

  useEffect(() => {
    const btn = buttonRef.current;
    if (!btn) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault(); // Prevent double firing with click
      triggerSpeech();
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      triggerSpeech();
    };

    btn.addEventListener('click', handleClick);
    btn.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      btn.removeEventListener('click', handleClick);
      btn.removeEventListener('touchstart', handleTouchStart);
    };
  }, [text, isPlaying, isLoading, usePremium, voicesAvailable]); // Re-bind when state changes that affects triggerSpeech

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
            <AudioLines className={cn("animate-pulse text-cyan-400", iconSizeClasses)} />
            <Square className="w-2.5 h-2.5 fill-current opacity-70" />
          </div>
        ) : (
          <Volume2 className={iconSizeClasses} />
        )}
      </button>

      {/* Voice Options Toggle */}
      <div className="relative z-20" ref={optionsRef}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowOptions(!showOptions);
          }}
          className={cn(
            "relative p-1 rounded transition-colors touch-manipulation",
            "before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:min-w-[32px] before:min-h-[48px] before:content-['']",
            showOptions ? "bg-white/10 text-white" : "text-white/30 hover:text-white/70 hover:bg-black/20"
          )}
          title="Voice Engine Options"
        >
          <Settings2 className="w-3 h-3" />
        </button>

        {showOptions && (
          <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded shadow-2xl p-1.5 min-w-[140px]">
            <div className="text-[9px] font-bold text-white/40 mb-1.5 px-2 uppercase tracking-wider">Voice Engine</div>
            <button
               onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   setUsePremium(false);
                   setShowOptions(false);
                   stopPlaying();
               }}
               className={cn(
                 "w-full text-left px-2 py-2 rounded text-xs mb-1 flex items-center justify-between touch-manipulation",
                 !usePremium ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5"
               )}
            >
               <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3 h-3 opacity-50" />
                  Standard
               </span>
               {!usePremium && <Check className="w-3 h-3 text-green-400" />}
            </button>
            <button
               onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   setUsePremium(true);
                   setShowOptions(false);
                   stopPlaying();
               }}
               className={cn(
                 "w-full text-left px-2 py-2 rounded text-xs flex items-center justify-between touch-manipulation",
                 usePremium ? "bg-cyan-500/10 text-cyan-400" : "text-white/50 hover:bg-white/5"
               )}
            >
               <span className="flex items-center gap-1.5">
                 <Sparkles className={cn("w-3 h-3", usePremium ? "text-cyan-400" : "opacity-50")} />
                 Premium
               </span>
               {usePremium && <Check className="w-3 h-3 text-cyan-400" />}
            </button>
          </div>
        )}
      </div>
      
      {errorMsg && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-500 text-white text-xs px-2 py-1 rounded select-none pointer-events-none z-50 shadow-xl border border-red-400/30">
          {errorMsg}
        </div>
      )}

      {showPermissionWarning && (
        <div className="absolute bottom-full mb-3 right-0 w-[240px] bg-gray-800 text-gray-200 text-xs p-3 rounded-lg shadow-xl border border-white/10 flex items-start gap-2 z-50">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-medium text-white">Audio not available</span>
            <span className="text-[11px] text-gray-400 leading-tight">
              Check site sound permissions in Chrome settings (Settings → Site Settings → Sound → Allow).
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

