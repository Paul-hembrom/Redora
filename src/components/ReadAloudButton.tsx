import React, { useState, useRef } from 'react';
import { Volume2, Square, Loader2 } from 'lucide-react';
import { elevenlabsTTS, synthesizeSpeech } from '../lib/gemini';
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    if (isLoading) return;

    try {
      setIsLoading(true);
      setErrorMsg('');
      let url: string | null = null;
      try {
        url = await elevenlabsTTS(text);
      } catch (err) {
        console.warn('ElevenLabs TTS failed, attempting fallback...', err);
        // Fall back to Gemini TTS or Browser SpeechSynthesis
        fallbackToBrowserTTS();
        return;
      }
      
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        fallbackToBrowserTTS();
      };
      
      setIsPlaying(true);
      setIsLoading(false);
      await audio.play();
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      setIsPlaying(false);
      showError();
    }
  };

  const fallbackToBrowserTTS = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showError();
      setIsLoading(false);
      setIsPlaying(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    // Try to find a high quality English voice
    const goodVoice = voices.find(v => v.lang.startsWith('en-') && (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Premium'))) || voices[0];
    if (goodVoice) utterance.voice = goodVoice;
    
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => {
      setIsPlaying(false);
      showError();
    };
    
    setIsPlaying(true);
    setIsLoading(false);
    window.speechSynthesis.speak(utterance);
    
    audioRef.current = {
      pause: () => window.speechSynthesis.cancel(),
      currentTime: 0
    } as any;
  };

  const showError = () => {
    setErrorMsg('Could not read aloud right now.');
    setTimeout(() => {
      setErrorMsg('');
    }, 3000);
  };

  return (
    <div className="relative inline-flex items-center">
      <button 
        onClick={handleToggle}
        className={cn("p-1.5 bg-black/20 hover:bg-black/40 rounded text-white/50 hover:text-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center", className)}
        title={isPlaying ? "Stop Reading" : "Read Aloud"}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className={cn("animate-spin", iconSizeClasses)} />
        ) : isPlaying ? (
          <Square className={cn("fill-current", iconSizeClasses)} />
        ) : (
          <Volume2 className={iconSizeClasses} />
        )}
      </button>
      
      {errorMsg && (
        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-500/90 text-white text-[10px] px-2 py-1 rounded select-none pointer-events-none z-50 shadow">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
