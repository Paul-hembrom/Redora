import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, Mic, MicOff, Send, X, Loader2, Volume2, Square, Sparkles } from 'lucide-react';
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

  // Separate Audio Element for Answers (Rule R3)
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

  // Detect org user vs individual user
  const [isOrgUser, setIsOrgUser] = useState(false);

  useEffect(() => {
    try {
      const cookies = document.cookie.split('; ');
      const orgCookie = cookies.find(r => r.startsWith('sb-org-id='))?.split('=')[1];
      const roleCookie = cookies.find(r => r.startsWith('sb-role='))?.split('=')[1];
      const isOrg = Boolean(orgCookie && orgCookie !== 'demo' && orgCookie !== 'default_org');
      setIsOrgUser(isOrg);

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
      x: Math.max(16, (window.innerWidth || 800) - 160),
      y: Math.max(16, (window.innerHeight || 600) - 100),
    };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({ x: 0, y: 0, posX: 0, posY: 0 });

  // Subscribe to ReadAloud Bus (Rule R4 - Read-only)
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
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = Math.min(Math.max(12, dragStartRef.current.posX + dx), window.innerWidth - 140);
    const newY = Math.min(Math.max(12, dragStartRef.current.posY + dy), window.innerHeight - 60);
    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
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

  return (
    <>
      {/* Draggable Pill Button */}
      {state === 'pill' && (
        <div
          style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="fixed z-[990] select-none touch-none cursor-grab active:cursor-grabbing flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white pl-3 pr-1.5 py-1.5 rounded-full shadow-lg shadow-cyan-900/40 border border-cyan-400/40 transition-shadow animate-in fade-in zoom-in duration-150"
        >
          <button
            onClick={() => setState('asking')}
            className="flex items-center gap-1.5 font-medium text-sm focus:outline-none"
          >
            <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse" />
            <span>Ask</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setState('dismissed');
            }}
            className="p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors ml-0.5"
            title="Dismiss Ask button"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Centred Modal UI */}
      {(state === 'asking' || state === 'answering') && (
        <div className="fixed inset-0 z-[999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="w-[min(90vw,560px)] min-h-[260px] max-h-[min(70vh,460px)] flex flex-col rounded-2xl bg-slate-900 text-slate-100 border border-slate-700/80 shadow-2xl overflow-hidden p-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-base text-slate-100">Ask about this sentence</h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Context Sentence Preview */}
            {contextRef.current.sentence && (
              <div className="my-3 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 italic line-clamp-2">
                "{contextRef.current.sentence}"
              </div>
            )}

            {/* Modal Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Error State */}
              {errorMsg ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                  <p className="text-sm text-red-400 mb-3">{errorMsg}</p>
                  <button
                    onClick={() => handleAskSubmit()}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : isLoadingAnswer ? (
                /* Loading State */
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  <p className="text-sm">Explaining sentence...</p>
                </div>
              ) : state === 'answering' ? (
                /* Answer Display State */
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  <div className="flex-1 overflow-y-auto my-2 pr-1 text-slate-200 text-sm md:text-base leading-relaxed space-y-2">
                    <p>{answerText}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-cyan-400">
                      {isPlayingAnswerAudio ? (
                        <>
                          <Volume2 className="w-4 h-4 animate-pulse text-cyan-400" />
                          <span>Reading answer aloud...</span>
                        </>
                      ) : (
                        <span className="text-slate-400">Answer complete</span>
                      )}
                    </div>

                    <button
                      onClick={handleCloseModal}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                    >
                      {isPlayingAnswerAudio && <Square className="w-3.5 h-3.5 fill-current" />}
                      <span>{isPlayingAnswerAudio ? 'Stop & Close' : 'Close'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Question Input Form State */
                <form onSubmit={handleAskSubmit} className="flex-1 flex flex-col justify-between pt-1">
                  <div className="relative">
                    <textarea
                      value={questionInput}
                      onChange={(e) => setQuestionInput(e.target.value.slice(0, 350))}
                      placeholder="What is confusing about this sentence?"
                      rows={3}
                      maxLength={350}
                      autoFocus
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAskSubmit();
                        }
                      }}
                    />
                    <div className="absolute right-3 bottom-3 text-[11px] text-slate-500 select-none">
                      {350 - questionInput.length}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    {/* Microphone button */}
                    {micAllowed ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onMouseDown={startRecording}
                          onMouseUp={stopRecording}
                          onTouchStart={startRecording}
                          onTouchEnd={stopRecording}
                          disabled={isTranscribing}
                          className={cn(
                            'p-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-medium',
                            isRecording
                              ? 'bg-red-500/20 border-red-500 text-red-300 animate-pulse'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                          )}
                          title="Hold to speak your question"
                        >
                          {isTranscribing ? (
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                          ) : (
                            <Mic className={cn('w-4 h-4', isRecording && 'text-red-400')} />
                          )}
                          <span>
                            {isRecording
                              ? `Listening (${recordingTime}s)...`
                              : isTranscribing
                              ? 'Transcribing...'
                              : 'Hold Mic'}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <MicOff className="w-3.5 h-3.5" />
                        <span>Type question</span>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={!questionInput.trim() || isLoadingAnswer || isTranscribing}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all shadow-md shadow-cyan-950 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Ask DeepSeek</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
