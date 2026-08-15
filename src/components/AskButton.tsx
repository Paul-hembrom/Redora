import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HelpCircle, Mic, MicOff, Send, X, Loader2, Volume2, Square, Sparkles, GripHorizontal } from 'lucide-react';
import { subscribeReadAloud } from '../lib/readAloudBus';
import { cn } from '../lib/utils';

type AskState = 'hidden' | 'pill' | 'asking' | 'answering' | 'dismissed';

export function AskButton() {
  // Feature flag check
  if (import.meta.env.VITE_ENABLE_ASK === '0') {
    return null;
  }

  const [state, setState] = useState<AskState>('hidden');
  const [questionInput, setQuestionInput] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Context from read-aloud pause event
  const contextRef = useRef<{ sentence: string; paragraph: string }>({ sentence: '', paragraph: '' });

  // Separate Audio Element for Answers
  const answerAudioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const activeSessionRef = useRef<boolean>(false);
  const [isPlayingAnswerAudio, setIsPlayingAnswerAudio] = useState(false);

  // Microphone recording
  const [micAllowed, setMicAllowed] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Word-synced highlighting & autoscroll refs/state
  const answerContainerRef = useRef<HTMLDivElement | null>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [activeWord, setActiveWord] = useState(-1);
  const [wordProgress, setWordProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const searchPosRef = useRef(0);
  const wordOffsetRef = useRef(0);

  // Tokenize answer into words
  const answerWords = useMemo(() => {
    if (!answerText) return [] as { text: string; start: number }[];
    const out: { text: string; start: number }[] = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(answerText))) {
      out.push({ text: m[0], start: m.index });
    }
    return out;
  }, [answerText]);

  // background-clip:text is the most expensive paint in the app; a 4GB
  // smartboard must not repaint it per frame.
  const isLowEnd = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    try {
      const nav = navigator as any;
      return (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4)
          || (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4);
    } catch (e) {
      return false;
    }
  }, []);

  useEffect(() => {
    setMicAllowed(true);
  }, []);

  // Draggable position
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = sessionStorage.getItem('readora.ask.pos');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      x: Math.max(16, (typeof window !== 'undefined' ? window.innerWidth : 800) - 220),
      y: Math.max(16, (typeof window !== 'undefined' ? window.innerHeight : 600) - 120),
    };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number; moved: boolean }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
    moved: false,
  });

  // Subscribe to ReadAloud Bus
  useEffect(() => {
    const unsubscribe = subscribeReadAloud((event) => {
      if (event.type === 'paused') {
        contextRef.current = {
          sentence: event.sentence,
          paragraph: event.paragraph,
        };
        setState('pill');
      } else if (event.type === 'resumed' || event.type === 'stopped') {
        stopAnswerAudio();
        setState('hidden');
        setQuestionInput('');
        setAnswerText('');
        setErrorMsg(null);
      }
    });

    return () => {
      unsubscribe();
      stopAnswerAudio();
    };
  }, []);

  // Web Speech API fallback
  const speakWithWebSpeech = (textToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsPlayingAnswerAudio(false);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.95;
      utterance.onend = () => {
        setIsPlayingAnswerAudio(false);
        setActiveWord(-1);
        setWordProgress(0);
      };
      utterance.onerror = () => {
        setIsPlayingAnswerAudio(false);
        setActiveWord(-1);
        setWordProgress(0);
      };
      setIsPlayingAnswerAudio(true);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setIsPlayingAnswerAudio(false);
    }
  };

  // Stop answer audio helper
  const stopAnswerAudio = () => {
    activeSessionRef.current = false;
    setIsPlayingAnswerAudio(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setActiveWord(-1);
    setWordProgress(0);
    if (answerAudioRef.current) {
      try {
        answerAudioRef.current.pause();
        answerAudioRef.current.onended = null;
        answerAudioRef.current.onerror = null;
        answerAudioRef.current.onplay = null;
        answerAudioRef.current.removeAttribute('src');
      } catch (e) {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    objectUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    });
    objectUrlsRef.current = [];
  };

  // Helper to convert base64 data URIs to Blob URLs for better media decoder compatibility
  const base64ToBlobUrl = (base64Data: string): string => {
    try {
      const cleanBase64 = base64Data.replace(/^data:audio\/\w+;base64,/, '');
      const binaryStr = atob(cleanBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    } catch (e) {
      return base64Data;
    }
  };

  // Map chunk timestamps to global word indices
  const computeWordOffset = (chunkText: string, fullAnswer: string): number => {
    let idx = fullAnswer.indexOf(chunkText, searchPosRef.current);
    if (idx === -1) idx = fullAnswer.indexOf(chunkText);
    if (idx === -1) return wordOffsetRef.current;
    const offset = answerWords.findIndex(w => w.start >= idx);
    searchPosRef.current = idx + chunkText.length;
    if (offset !== -1) wordOffsetRef.current = offset;
    return wordOffsetRef.current;
  };

  // Real autoscroll inside answer container (no scrollIntoView)
  const scrollWordIntoView = (idx: number) => {
    const c = answerContainerRef.current;
    const el = wordRefs.current[idx];
    if (!c || !el) return;
    const cr = c.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const margin = 28;
    if (r.bottom > cr.bottom - margin || r.top < cr.top + margin) {
      const target = c.scrollTop + (r.top - cr.top) - c.clientHeight / 2 + r.height / 2;
      c.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }
  };

  // RAF loop for word-synced highlights
  const PROGRESS_STEPS = 20;

  const runHighlightLoop = (audio: HTMLAudioElement, timestamps: any[], wordOffset: number) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (!timestamps?.length) return;

    let cursor = 0, lastActive = -1, lastBucket = -1;
    const tsStart = (t: any) => (t.start_time !== undefined ? t.start_time : t.start);
    const tsEnd   = (t: any) => (t.end_time   !== undefined ? t.end_time   : t.end);

    const loop = () => {
      if (!activeSessionRef.current || audio.paused || audio.ended) return;
      const now = audio.currentTime;

      if (cursor > 0 && now < tsStart(timestamps[cursor])) cursor = 0;
      while (cursor < timestamps.length - 1 && now >= tsEnd(timestamps[cursor])) cursor++;

      const ts = timestamps[cursor];
      const s = tsStart(ts), e = tsEnd(ts);
      const globalIdx = (now >= s && now < e) ? wordOffset + cursor : -1;

      if (globalIdx !== lastActive) {
        lastActive = globalIdx;
        lastBucket = -1;
        setActiveWord(globalIdx);
        if (globalIdx >= 0) scrollWordIntoView(globalIdx);
      }

      if (globalIdx >= 0 && !isLowEnd) {
        const dur = e - s;
        const p = dur > 0 ? Math.max(0, Math.min(1, (now - s) / dur)) : 1;
        const bucket = Math.round(p * PROGRESS_STEPS);
        if (bucket !== lastBucket) {
          lastBucket = bucket;
          setWordProgress((bucket / PROGRESS_STEPS) * 100);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  // Play answer using Cartesia TTS or Web Speech fallback
  const playAnswerAudio = async (textToPlay: string) => {
    stopAnswerAudio();
    if (!textToPlay) return;

    searchPosRef.current = 0;
    wordOffsetRef.current = 0;
    setActiveWord(-1);
    setWordProgress(0);

    activeSessionRef.current = true;
    setIsPlayingAnswerAudio(true);

    try {
      const res = await fetch('/api/tts/cartesia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToPlay }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Cartesia HTTP error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const queue: { url: string; timestamps: any[]; chunkText: string }[] = [];
      let isPlayingQueue = false;
      let hasQueuedAudio = false;

      const playNextChunk = () => {
        if (!activeSessionRef.current) return;
        if (queue.length === 0) {
          isPlayingQueue = false;
          setIsPlayingAnswerAudio(false);
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          setActiveWord(-1);
          setWordProgress(0);
          return;
        }

        isPlayingQueue = true;
        setIsPlayingAnswerAudio(true);
        const next = queue.shift()!;

        if (!answerAudioRef.current) {
          answerAudioRef.current = new Audio();
        }
        const audio = answerAudioRef.current;
        audio.onended = null;
        audio.onerror = null;
        audio.onplay = null;
        audio.pause();
        audio.src = next.url;

        audio.onplay = () => {
          const offset = computeWordOffset(next.chunkText, textToPlay);
          runHighlightLoop(audio, next.timestamps, offset);
        };

        audio.onended = () => {
          playNextChunk();
        };
        audio.onerror = (e) => {
          console.warn('[ask-tts] chunk play error, continuing:', e);
          playNextChunk();
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[ask-tts] audio.play() was prevented/failed:', err);
            if (activeSessionRef.current) {
              speakWithWebSpeech(textToPlay);
            }
          });
        }
      };

      while (activeSessionRef.current) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              let audioSrc = data.audioUrl;
              if (!audioSrc && data.audio) {
                audioSrc = data.audio.startsWith('data:') ? data.audio : `data:audio/wav;base64,${data.audio}`;
              }

              if (audioSrc) {
                let blobUrl = audioSrc;
                if (audioSrc.startsWith('data:')) {
                  blobUrl = base64ToBlobUrl(audioSrc);
                  objectUrlsRef.current.push(blobUrl);
                }

                hasQueuedAudio = true;
                queue.push({
                  url: blobUrl,
                  timestamps: data.timestamps || [],
                  chunkText: data.text || '',
                });

                if (!isPlayingQueue) {
                  playNextChunk();
                }
              }
            } catch (e) {}
          }
        }
      }

      if (!hasQueuedAudio && activeSessionRef.current) {
        speakWithWebSpeech(textToPlay);
      }
    } catch (err) {
      console.warn('[ask-tts] Cartesia TTS call failed, falling back to Web Speech:', err);
      if (activeSessionRef.current) {
        speakWithWebSpeech(textToPlay);
      }
    }
  };

  // Dragging handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: pos.x,
      posY: pos.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    if (Math.hypot(dx, dy) > 4) {
      dragStartRef.current.moved = true;
      const cardW = state === 'pill' ? 140 : 380;
      const cardH = state === 'pill' ? 44 : 280;
      const newX = Math.min(Math.max(12, dragStartRef.current.posX + dx), (typeof window !== 'undefined' ? window.innerWidth : 800) - cardW - 12);
      const newY = Math.min(Math.max(12, dragStartRef.current.posY + dy), (typeof window !== 'undefined' ? window.innerHeight : 600) - cardH - 12);
      setPos({ x: newX, y: newY });
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    try {
      sessionStorage.setItem('readora.ask.pos', JSON.stringify(pos));
    } catch (e) {}
  };

  // Mic handlers with live Web Speech recognition + backend Whisper fallback
  const startRecording = async () => {
    // 1. Web Speech API for real-time live transcription
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        const initialInput = questionInput;
        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            const combined = (initialInput ? initialInput + ' ' + transcript : transcript).trim();
            setQuestionInput(combined.slice(0, 350));
          }
        };
        recognition.onerror = (e: any) => {
          console.warn('[ask-mic] SpeechRecognition error:', e);
        };
        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch (e) {
        console.warn('[ask-mic] SpeechRecognition start failed:', e);
      }
    }

    // 2. MediaRecorder for backend audio transcription fallback
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordTimerRef.current);
        setIsRecording(false);
        setRecordingTime(0);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) return;

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'audio.webm');
          const token = document.cookie.split('; ').find((row) => row.startsWith('token='))?.split('=')[1];
          const res = await fetch('/api/stt/transcribe', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            if (data.text && data.text.trim()) {
              setQuestionInput((prev) => {
                const text = data.text.trim();
                if (prev.includes(text)) return prev;
                const combined = (prev ? prev + ' ' + text : text).trim();
                return combined.slice(0, 350);
              });
            }
          }
        } catch (err) {
          console.error('[ask-mic] transcribe failed:', err);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingTime((t) => {
          if (t >= 19) {
            stopRecording();
            return 20;
          }
          return t + 1;
        });
      }, 1000);
    } catch (err) {
      console.warn('[ask-mic] mic permission denied:', err);
      // Fallback: user can still type
    }
  };

  const stopRecording = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Question submission
  const handleAskSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = questionInput.trim();
    if (!q || q.length > 350) return;

    // Unlock media element during user gesture so browser allows autoplay after async response
    if (!answerAudioRef.current) {
      answerAudioRef.current = new Audio();
    }
    try {
      answerAudioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      answerAudioRef.current.play().catch(() => {});
    } catch (e) {}

    setState('asking');
    setIsLoadingAnswer(true);
    setErrorMsg(null);
    setAnswerText('');

    try {
      const token = document.cookie.split('; ').find((row) => row.startsWith('token='))?.split('=')[1];
      const res = await fetch('/api/ask/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question: q,
          sentence: contextRef.current.sentence,
          paragraph: contextRef.current.paragraph,
          chapterTitle: typeof document !== 'undefined' ? document.title || 'Lesson Chapter' : 'Lesson Chapter',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}`);
      }

      const data = await res.json();
      const ans = data.answer;
      setAnswerText(ans);
      setState('answering');
      setIsLoadingAnswer(false);

      // Play answer via TTS immediately upon generation
      playAnswerAudio(ans);
    } catch (err: any) {
      console.error('[ask] error:', err);
      setErrorMsg(err.message || "Couldn't answer right now. Try again.");
      setIsLoadingAnswer(false);
    }
  };

  const handleCloseModal = () => {
    stopAnswerAudio();
    setState('pill');
    setErrorMsg(null);
  };

  if (state === 'hidden' || state === 'dismissed') {
    return null;
  }

  const isSpeaking = state === 'answering';

  // Adaptive positioning and sizing
  const cardWidth = Math.min(typeof window !== 'undefined' ? window.innerWidth - 32 : 380, 420);
  const leftPos = typeof window !== 'undefined'
    ? Math.min(Math.max(12, pos.x), Math.max(12, window.innerWidth - cardWidth - 12))
    : pos.x;
  const topPos = typeof window !== 'undefined'
    ? Math.min(Math.max(12, pos.y), Math.max(12, window.innerHeight - 340))
    : pos.y;

  const cardStyle: React.CSSProperties = isSpeaking
    ? {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(92vw, 620px)',
        transition: 'width 220ms ease, max-height 220ms ease',
      }
    : {
        left: `${leftPos}px`,
        top: `${topPos}px`,
        width: `${cardWidth}px`,
        transition: isDraggingRef.current ? undefined : 'width 220ms ease, max-height 220ms ease',
      };

  // Longer answers get more room, up to a ceiling. Viewport units protect Focus Mode / 3XL font.
  const answerLen = answerText.length;
  const bodyMaxHeight =
    answerLen < 250  ? 'min(30vh, 200px)' :
    answerLen < 700  ? 'min(45vh, 320px)' :
                       'min(60vh, 440px)';

  return (
    <>
      {/* 1. Small Floating Pill State */}
      {state === 'pill' && (
        <div
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            willChange: isDraggingRef.current ? 'transform' : undefined,
          }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            handlePointerDown(e);
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => {
            (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
            handlePointerUp();
          }}
          className="fixed z-[990] select-none touch-none cursor-grab active:cursor-grabbing flex items-center gap-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white pl-3 pr-1.5 py-2 rounded-full shadow-xl shadow-cyan-950/50 border border-cyan-400/40 transition-transform active:scale-95 animate-in fade-in zoom-in duration-150"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!dragStartRef.current.moved) {
                setState('asking');
              }
            }}
            className="flex items-center gap-1.5 font-medium text-sm focus:outline-none"
          >
            <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse" />
            <span>Ask</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setState('dismissed');
            }}
            className="p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors ml-1"
            title="Dismiss Ask button"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Expanded Floating Input Bar / Answer Card State (In-place on button, centered when answering) */}
      {(state === 'asking' || state === 'answering') && (
        <div
          style={cardStyle}
          className="fixed z-[995] flex flex-col rounded-2xl bg-slate-900/95 text-slate-100 border border-cyan-500/40 shadow-2xl backdrop-blur-md overflow-hidden p-4 animate-in fade-in zoom-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header & Drag Grip (Drag only when not speaking) */}
          <div
            onPointerDown={(e) => {
              if (isSpeaking) return;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              handlePointerDown(e);
            }}
            onPointerMove={(e) => {
              if (isSpeaking) return;
              handlePointerMove(e);
            }}
            onPointerUp={(e) => {
              if (isSpeaking) return;
              (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
              handlePointerUp();
            }}
            className={cn(
              "flex items-center justify-between pb-2 mb-2 border-b border-slate-800 select-none",
              !isSpeaking && "cursor-grab active:cursor-grabbing"
            )}
          >
            <div className="flex items-center gap-2">
              {!isSpeaking && <GripHorizontal className="w-4 h-4 text-slate-500 hover:text-slate-300" />}
              <div className="p-1 rounded bg-cyan-500/20 text-cyan-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-semibold text-xs text-slate-200">
                {isSpeaking ? 'Readora Explanation' : 'Ask about sentence'}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleCloseModal}
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Close Ask"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Context Sentence Preview */}
          {contextRef.current.sentence && (
            <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-cyan-200/90 italic line-clamp-2">
              "{contextRef.current.sentence}"
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 flex flex-col">
            {errorMsg ? (
              <div className="flex flex-col items-center justify-center text-center p-3">
                <p className="text-xs text-red-400 mb-2">{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => handleAskSubmit()}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : isLoadingAnswer ? (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-400 py-6">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <p className="text-xs">Explaining sentence...</p>
              </div>
            ) : state === 'answering' ? (
              <div className="flex flex-col justify-between space-y-3">
                <div
                  ref={answerContainerRef}
                  className="overflow-y-auto pr-1 text-slate-200 text-sm md:text-base leading-relaxed"
                  style={{ maxHeight: bodyMaxHeight, transition: 'max-height 220ms ease' }}
                >
                  <p className="leading-relaxed">
                    {answerWords.map((w, i) => {
                      // Match ReadAloudButton.tsx exactly (lines 770-794) so the two features feel
                      // like one product. Amber on the dark slate-900 popup is the same treatment
                      // the document reader already uses.
                      const HIGHLIGHT = '#FBBF24'; // amber-400, identical to ReadAloudButton
                      const REST = '#CBD5E1'; // slate-300, the normal answer text colour

                      const activeStyle = isLowEnd
                        ? { backgroundColor: '#FBBF24', color: '#111827' }
                        : {
                            background: `linear-gradient(to right, ${HIGHLIGHT} ${wordProgress}%, ${REST} ${wordProgress}%)`,
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                          };
                      const spokenStyle = { opacity: 0.55, transition: 'opacity 300ms ease' };

                      return (
                        <span
                          key={i}
                          ref={(el) => {
                            wordRefs.current[i] = el;
                          }}
                          className="rounded inline"
                          style={
                            i === activeWord
                              ? activeStyle
                              : activeWord >= 0 && i < activeWord
                              ? spokenStyle
                              : undefined
                          }
                        >
                          {w.text}{' '}
                        </span>
                      );
                    })}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      if (isPlayingAnswerAudio) {
                        stopAnswerAudio();
                      } else {
                        playAnswerAudio(answerText);
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border",
                      isPlayingAnswerAudio
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 animate-pulse shadow-sm shadow-cyan-500/30"
                        : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white"
                    )}
                    title={isPlayingAnswerAudio ? "Stop reading aloud" : "Read answer aloud"}
                  >
                    {isPlayingAnswerAudio ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current text-cyan-400" />
                        <span className="flex items-center gap-1">
                          <span>Speaking</span>
                          <span className="flex gap-0.5 items-center">
                            <span className="w-1 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span className="w-1 h-3 bg-cyan-400 rounded-full animate-pulse delay-75"></span>
                            <span className="w-1 h-1.5 bg-cyan-400 rounded-full animate-pulse delay-150"></span>
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Read Aloud</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Question Input Bar & Mic Section */
              <form onSubmit={handleAskSubmit} className="flex flex-col gap-2">
                <div className="relative">
                  <textarea
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value.slice(0, 350))}
                    placeholder={isRecording ? "Listening to your question..." : "What is confusing about this sentence?"}
                    rows={2}
                    maxLength={350}
                    autoFocus
                    className={cn(
                      "w-full bg-slate-950/90 border rounded-xl p-2.5 pr-10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none transition-all",
                      isRecording
                        ? "border-red-500/60 ring-1 ring-red-500/40 bg-red-950/20"
                        : "border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    )}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAskSubmit();
                      }
                    }}
                  />
                  
                  {/* Embedded Microphone Quick Action inside text area corner */}
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isTranscribing}
                    className={cn(
                      "absolute right-2 top-2 p-1.5 rounded-lg transition-all",
                      isRecording
                        ? "bg-red-500 text-white animate-bounce shadow-md shadow-red-500/50"
                        : "text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80"
                    )}
                    title={isRecording ? "Click to stop recording" : "Click to speak question"}
                  >
                    {isTranscribing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    ) : (
                      <Mic className={cn("w-3.5 h-3.5", isRecording && "text-white")} />
                    )}
                  </button>

                  <div className="absolute right-2 bottom-2 text-[10px] text-slate-500 select-none">
                    {350 - questionInput.length}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {/* Microphone Status Indicator */}
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isTranscribing}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-medium',
                      isRecording
                        ? 'bg-red-500/20 border-red-500 text-red-300 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                    )}
                    title={isRecording ? 'Click to stop recording' : 'Click to speak question'}
                  >
                    {isTranscribing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    ) : (
                      <Mic className={cn('w-3.5 h-3.5', isRecording ? 'text-red-400' : 'text-slate-400')} />
                    )}
                    <span>
                      {isRecording
                        ? `Recording (${recordingTime}s)...`
                        : isTranscribing
                        ? 'Transcribing...'
                        : 'Voice Input'}
                    </span>
                  </button>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!questionInput.trim() || isLoadingAnswer || isTranscribing}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Send className="w-3 h-3" />
                    <span>Ask Readora AI</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
