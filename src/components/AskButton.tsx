import React, { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    try {
      const cookies = document.cookie.split('; ');
      const orgCookie = cookies.find(r => r.startsWith('sb-org-id='))?.split('=')[1];
      const isOrg = Boolean(orgCookie && orgCookie !== 'demo' && orgCookie !== 'default_org');

      const micSetting = isOrg
        ? localStorage.getItem('readora.ask.micEnabled') === '1'
        : localStorage.getItem('readora.ask.micEnabled') !== '0';
      setMicAllowed(micSetting);
    } catch (e) {}
  }, []);

  // Draggable position
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = sessionStorage.getItem('readora.ask.pos');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      x: Math.max(16, (window.innerWidth || 800) - 220),
      y: Math.max(16, (window.innerHeight || 600) - 120),
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

  // Stop answer audio helper
  const stopAnswerAudio = () => {
    activeSessionRef.current = false;
    setIsPlayingAnswerAudio(false);
    if (answerAudioRef.current) {
      try {
        answerAudioRef.current.pause();
        answerAudioRef.current.removeAttribute('src');
      } catch (e) {}
      answerAudioRef.current = null;
    }
    objectUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    });
    objectUrlsRef.current = [];
  };

  // Play answer using Cartesia TTS
  const playAnswerAudio = async (text: string) => {
    stopAnswerAudio();
    if (!text) return;

    activeSessionRef.current = true;
    setIsPlayingAnswerAudio(true);

    try {
      const res = await fetch('/api/tts/cartesia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok || !res.body) {
        setIsPlayingAnswerAudio(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const queue: string[] = [];
      let isPlayingQueue = false;

      const playNextChunk = () => {
        if (!activeSessionRef.current) return;
        if (queue.length === 0) {
          isPlayingQueue = false;
          setIsPlayingAnswerAudio(false);
          return;
        }

        isPlayingQueue = true;
        setIsPlayingAnswerAudio(true);
        const nextUrl = queue.shift()!;

        const audio = new Audio(nextUrl);
        answerAudioRef.current = audio;

        audio.onended = () => {
          playNextChunk();
        };
        audio.onerror = () => {
          playNextChunk();
        };
        audio.play().catch(() => playNextChunk());
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
              if (data.audio) {
                const binaryStr = atob(data.audio);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'audio/wav' });
                const blobUrl = URL.createObjectURL(blob);
                objectUrlsRef.current.push(blobUrl);
                queue.push(blobUrl);

                if (!isPlayingQueue) {
                  playNextChunk();
                }
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.error('[ask-tts] Audio playback error:', err);
      setIsPlayingAnswerAudio(false);
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
      const newX = Math.min(Math.max(12, dragStartRef.current.posX + dx), window.innerWidth - cardW - 12);
      const newY = Math.min(Math.max(12, dragStartRef.current.posY + dy), window.innerHeight - cardH - 12);
      setPos({ x: newX, y: newY });
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    try {
      sessionStorage.setItem('readora.ask.pos', JSON.stringify(pos));
    } catch (e) {}
  };

  // Mic handlers
  const startRecording = async () => {
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
            if (data.text) {
              setQuestionInput((prev) => {
                const combined = (prev ? prev + ' ' + data.text : data.text).trim();
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
      setMicAllowed(false);
    }
  };

  const stopRecording = () => {
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
          chapterTitle: document.title || 'Lesson Chapter',
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

      // Play answer via TTS
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

  // Position calculations for expanding input bar card directly at pos
  const cardWidth = Math.min(typeof window !== 'undefined' ? window.innerWidth - 32 : 380, 420);
  const leftPos = typeof window !== 'undefined'
    ? Math.min(Math.max(12, pos.x), Math.max(12, window.innerWidth - cardWidth - 12))
    : pos.x;
  const topPos = typeof window !== 'undefined'
    ? Math.min(Math.max(12, pos.y), Math.max(12, window.innerHeight - 340))
    : pos.y;

  return (
    <>
      {/* 1. Small Floating Pill State */}
      {state === 'pill' && (
        <div
          style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
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

      {/* 2. Expanded Floating Input Bar / Answer Card State (In-place on button!) */}
      {(state === 'asking' || state === 'answering') && (
        <div
          style={{ left: `${leftPos}px`, top: `${topPos}px`, width: `${cardWidth}px` }}
          className="fixed z-[995] flex flex-col rounded-2xl bg-slate-900/95 text-slate-100 border border-cyan-500/40 shadow-2xl backdrop-blur-md overflow-hidden p-4 animate-in fade-in zoom-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header & Drag Grip */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="w-4 h-4 text-slate-500 hover:text-slate-300" />
              <div className="p-1 rounded bg-cyan-500/20 text-cyan-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-semibold text-xs text-slate-200">Ask about sentence</h3>
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
                <div className="max-h-[220px] overflow-y-auto pr-1 text-slate-200 text-xs md:text-sm leading-relaxed">
                  <p>{answerText}</p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-cyan-400">
                    {isPlayingAnswerAudio ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                        <span>Reading aloud...</span>
                      </>
                    ) : (
                      <span className="text-slate-400">Explanation ready</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    {isPlayingAnswerAudio && <Square className="w-3 h-3 fill-current" />}
                    <span>{isPlayingAnswerAudio ? 'Stop' : 'Done'}</span>
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
                    placeholder="What is confusing about this sentence?"
                    rows={2}
                    maxLength={350}
                    autoFocus
                    className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 pr-10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAskSubmit();
                      }
                    }}
                  />
                  <div className="absolute right-2 bottom-2 text-[10px] text-slate-500 select-none">
                    {350 - questionInput.length}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {/* Microphone Button */}
                  {micAllowed ? (
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
                        <Mic className={cn('w-3.5 h-3.5', isRecording && 'text-red-400')} />
                      )}
                      <span>
                        {isRecording
                          ? `Recording (${recordingTime}s)...`
                          : isTranscribing
                          ? 'Transcribing...'
                          : 'Voice'}
                      </span>
                    </button>
                  ) : (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <MicOff className="w-3 h-3" />
                      <span>Type question</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!questionInput.trim() || isLoadingAnswer || isTranscribing}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Send className="w-3 h-3" />
                    <span>Ask DeepSeek</span>
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
