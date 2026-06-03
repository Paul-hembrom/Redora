import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Pause, MessageCircleQuestion, Send, Loader2, Volume2, Mic, ArrowLeft, BookOpen, CheckCircle, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { TeacherAvatar } from './TeacherAvatar';
import { BetaBadge } from './BetaBadge';

interface LessonStep {
  id: string;
  type: 'video' | 'image' | 'question';
  url?: string;
  narration_audio_url?: string;
  narrationText?: string;
  caption?: string;
  text?: string; 
  duration?: number;
  emotion?: 'neutral' | 'smiling' | 'thinking' | 'excited' | 'curious';
  humor?: { setup: string, punchline: string, emotion: string } | null;
}

interface InteractiveLessonProps {
  topicId: string;
  topicTitle: string;
  onClose: () => void;
}

type LessonState = 'init' | 'launch' | 'playing' | 'paused' | 'asking' | 'ended';

export function InteractiveLesson({ topicId, topicTitle, onClose }: InteractiveLessonProps) {
  const [steps, setSteps] = useState<LessonStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [lessonState, setLessonState] = useState<LessonState>('init');
  const [error, setError] = useState<string | null>(null);
  
  // Chat / Q&A state
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: string, text: string}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Audio references
  const audioRef = useRef<HTMLAudioElement>(null);
  const chatAudioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [chatAudioPlaying, setChatAudioPlaying] = useState(false);

  useEffect(() => {
    async function fetchLesson() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/topics/${topicId}/start-lesson`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ orgId: 'demo' })
        });
        if (res.ok) {
          const data = await res.json();
          window.dispatchEvent(new Event('usage-updated'));
          setSteps(data.steps || []);
          setLessonState('launch');
        } else {
          const data = await res.json();
          throw new Error(data.error || 'Failed to start lesson');
        }
      } catch (err) {
        console.error(err);
        setError('Could not load lesson content.');
      }
    }
    fetchLesson();
  }, [topicId]);

  const currentStep = steps[currentStepIndex];

  // Auto-play TTS and video when step changes or resumes
  useEffect(() => {
    if (lessonState === 'playing' && currentStep) {
      if (currentStep.narration_audio_url && audioRef.current) {
        if (audioRef.current.getAttribute('src') !== currentStep.narration_audio_url) {
          audioRef.current.src = currentStep.narration_audio_url;
        }
        audioRef.current.play().catch(e => console.error("Audio block:", e));
      } else if (currentStep.type === 'image' && !currentStep.narration_audio_url) {
        // Fallback for image steps without audio
        const timer = setTimeout(handleNext, (currentStep.duration || 5) * 1000);
        return () => clearTimeout(timer);
      }
      
      if (currentStep.type === 'video' && videoRef.current) {
        if (videoRef.current.getAttribute('src') !== currentStep.url) {
           videoRef.current.src = currentStep.url || '';
        }
        videoRef.current.play().catch(e => console.error("Video block:", e));
      }
    }
  }, [currentStepIndex, lessonState, currentStep]);

  const handleStart = () => {
    setLessonState('playing');
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setLessonState('ended');
    }
  };

  const handlePause = () => {
    if (lessonState !== 'playing') return;
    setLessonState('paused');
    if (audioRef.current) audioRef.current.pause();
    if (videoRef.current) videoRef.current.pause();
  };

  const handleResume = () => {
    setLessonState('playing');
    if (chatAudioRef.current) { chatAudioRef.current.pause(); setChatAudioPlaying(false); }
  };

  const openAskScreen = () => {
    if (lessonState === 'playing') handlePause();
    setLessonState('asking');
  };

  const handleAudioEnded = () => {
    if (currentStep && currentStep.type === 'video' && videoRef.current && !videoRef.current.ended) {
      // wait for video
      return;
    }
    // If it's a question step, wait for user input (don't auto advance immediately unless we want a 5s delay)
    if (currentStep && currentStep.type === 'question') {
      openAskScreen();
      return;
    }
    handleNext();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        stream.getTracks().forEach(track => track.stop());
        
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'audio.webm');
          const token = localStorage.getItem('token');
          const res = await fetch('/api/stt/transcribe', {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: formData,
          });
          
          if (!res.ok) throw new Error('Transcription failed');
          const data = await res.json();
          if (data.text) {
            submitQuestionWithText(data.text);
          }
        } catch (err) {
          console.error("Transcription error:", err);
          setError("Sorry, couldn't understand that. Please try again.");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      setError("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const submitQuestionWithText = async (textToSubmit: string) => {
    if (!textToSubmit.trim()) return;

    const userMsgObj = { role: 'user', text: textToSubmit };
    setChatInput('');
    setChatHistory(prev => [...prev, userMsgObj]);
    setIsChatLoading(true);

    try {
       const token = localStorage.getItem('token');
       
       // Log to chat history
       await fetch(`/api/chats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify({ id: uuidv4(), role: 'user', text: textToSubmit, chapterId: topicId })
       });

       const contentContext = `Current Step Content: ${currentStep?.caption || currentStep?.text || currentStep?.narrationText || ''}`;
       
       const { generateChatResponse } = await import('../lib/gemini');
       const aiResult = await generateChatResponse(textToSubmit, contentContext, chatHistory as any, { tone: 'Enthusiastic', complexity: 'Intermediate' } as any);

       setChatHistory(prev => [...prev, { role: 'model', text: aiResult.response }]);
       
       await fetch(`/api/chats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify({ id: uuidv4(), role: 'model', text: aiResult.response, chapterId: topicId })
       });

       // Trigger TTS for AI response
       try {
         const ttsRes = await fetch(`/api/tts`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ text: aiResult.response })
         });
         
         if (ttsRes.ok) {
           const { audioUrl } = await ttsRes.json();
           if (chatAudioRef.current) {
             chatAudioRef.current.src = audioUrl;
             chatAudioRef.current.play().catch(console.error);
             setChatAudioPlaying(true);
           }
         }
       } catch (err) {
         console.error("TTS play error", err);
       }
    } catch (err) {
      console.error(err);
      setError("Failed to get an answer.");
    } finally {
      setIsChatLoading(false);
    }
  };

  const submitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    await submitQuestionWithText(chatInput.trim());
  };

  if (lessonState === 'init') {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/95 backdrop-blur-md font-sans">
         <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4" />
            <p className="text-white/60 font-medium text-lg">Preparing your interactive lesson...</p>
            {error && <p className="text-red-400 mt-4">{error}</p>}
         </div>
      </div>,
      document.body
    );
  }

  if (lessonState === 'launch') {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950 font-sans">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-zinc-950 pointer-events-none" />
        
        <div className="absolute top-6 left-6 z-10">
          <button onClick={onClose} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-full text-white transition flex items-center gap-2 font-medium border border-white/10">
            <ArrowLeft className="w-5 h-5"/> Back to Details
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col items-center max-w-2xl text-center px-6"
        >
          <TeacherAvatar emotion="smiling" isSpeaking={false} className="w-48 h-48 mb-8 drop-shadow-[0_0_30px_rgba(34,211,238,0.3)]" />
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight flex items-center justify-center gap-4 flex-wrap">
            Ready to learn about <br/>
            <span className="text-cyan-400">{topicTitle}</span>? <BetaBadge className="text-sm px-3 py-1 bg-yellow-400/20 border-yellow-400/50 text-yellow-300" />
          </h1>
          <p className="text-xl text-white/70 mb-12">
            I'm Maya, your teacher today! I'll guide you through the material.
          </p>
          <button 
            onClick={handleStart}
            className="group px-8 py-4 bg-cyan-500 hover:bg-cyan-400 rounded-full text-zinc-950 font-bold text-xl shadow-[0_0_40px_rgba(34,211,238,0.4)] hover:shadow-[0_0_60px_rgba(34,211,238,0.6)] transition-all flex items-center gap-3"
          >
            <Play className="w-6 h-6 fill-zinc-950" /> Start Lesson
          </button>
        </motion.div>
      </div>,
      document.body
    );
  }

  if (lessonState === 'ended') {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950 font-sans">
        <div className="absolute top-6 left-6 z-10">
          <button onClick={onClose} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-full text-white transition flex items-center gap-2 font-medium border border-white/10">
            <X className="w-5 h-5"/> Close Lesson
          </button>
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 border border-white/10 p-10 md:p-14 rounded-3xl max-w-2xl text-center shadow-2xl relative z-10 mx-4"
        >
          <CheckCircle className="w-20 h-20 text-cyan-400 mx-auto mb-6" />
          <h2 className="text-4xl font-bold text-white mb-4">Great job!</h2>
          <p className="text-xl text-white/70 mb-8">
            You've completed the interactive lesson on <b className="text-white">{topicTitle}</b>.
          </p>
          <button 
            onClick={onClose}
            className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded-full text-lg transition-colors border border-white/10"
          >
            Return to Topic
          </button>
        </motion.div>
      </div>,
      document.body
    );
  }

  // playing, paused, or asking state
  const isSpeaking = (lessonState === 'playing' && isAudioPlaying) || (lessonState === 'asking' && chatAudioPlaying);
  const teacherEmotion = lessonState === 'asking' 
    ? (chatAudioPlaying ? 'smiling' : 'curious') 
    : (currentStep?.emotion || 'neutral');

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col font-sans">
      <audio 
        ref={audioRef} 
        onEnded={handleAudioEnded}
        onPlay={() => setIsAudioPlaying(true)}
        onPause={() => setIsAudioPlaying(false)}
      />
      <audio 
        ref={chatAudioRef}
        onPlay={() => setChatAudioPlaying(true)}
        onPause={() => setChatAudioPlaying(false)}
      />
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-24 flex items-center justify-between px-6 bg-gradient-to-b from-zinc-950 to-transparent z-50 pointer-events-none">
        <button onClick={onClose} className="pointer-events-auto px-5 py-2.5 bg-zinc-900/80 hover:bg-zinc-800 rounded-full text-white transition flex items-center gap-2 font-medium backdrop-blur border border-white/10">
          <X className="w-5 h-5"/> Close
        </button>
        
        <div className="flex flex-col items-center">
          <span className="text-white/50 text-xs font-semibold tracking-wider uppercase mb-1">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <h2 className="text-white font-medium text-lg pointer-events-auto px-4 py-1.5 bg-black/40 backdrop-blur rounded-full border border-white/5 hidden md:block">
            {topicTitle}
          </h2>
        </div>

        <button 
          onClick={lessonState === 'playing' ? handlePause : handleResume}
          className="pointer-events-auto p-3.5 bg-cyan-500 hover:bg-cyan-400 rounded-full text-zinc-950 transition-colors shadow-[0_0_20px_rgba(34,211,238,0.2)]"
        >
          {lessonState === 'playing' ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
        </button>
      </div>

      {/* Main Content Area */}
      <div 
        className="flex-1 relative flex items-center justify-center bg-zinc-950 cursor-pointer overflow-hidden" 
        onClick={() => {
          if (lessonState === 'playing') handlePause();
          else if (lessonState === 'paused') handleResume();
        }}
      >
         {currentStep?.type === 'video' && currentStep.url ? (
           <video 
              ref={videoRef}
              src={currentStep.url} 
              className={cn("w-full h-full object-contain transition-opacity duration-500", lessonState !== 'playing' && "opacity-40")}
              playsInline
              onEnded={() => {
                if (audioRef.current && !audioRef.current.ended) return;
                handleNext();
              }}
           />
         ) : currentStep?.type === 'image' && currentStep.url ? (
           <img 
             src={currentStep.url} 
             alt="Visual" 
             className={cn("w-full h-full object-cover max-w-6xl mx-auto rounded-xl transition-all duration-700 shadow-2xl", lessonState !== 'playing' && "opacity-40 scale-[0.98]")} 
           />
         ) : currentStep?.type === 'question' ? (
           <div className="max-w-3xl text-center px-8 z-10">
              <MessageCircleQuestion className="w-20 h-20 text-cyan-400 mx-auto mb-8 animate-pulse" />
              <h3 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-10">{currentStep.text}</h3>
           </div>
         ) : (
           <div className="text-white/40"><BookOpen className="w-20 h-20 mb-4 opacity-50 mx-auto" /> Visual Missing</div>
         )}

         {/* Pause Overlay */}
         <AnimatePresence>
           {lessonState === 'paused' && (
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/60 backdrop-blur-sm z-30"
             >
               <Pause className="w-20 h-20 text-white/80 mb-6" />
               <h3 className="text-3xl font-semibold text-white mb-8 tracking-tight">Lesson Paused</h3>
               <div className="flex flex-col md:flex-row gap-4">
                 <button 
                   onClick={(e) => { e.stopPropagation(); handleResume(); }}
                   className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold rounded-full text-lg transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] flex items-center gap-2"
                 >
                   <Play className="w-5 h-5 fill-current" /> Resume
                 </button>
                 <button 
                   onClick={(e) => { e.stopPropagation(); openAskScreen(); }}
                   className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded-full text-lg transition-colors border border-white/10 flex items-center gap-2"
                 >
                   <MessageCircleQuestion className="w-5 h-5" /> Ask a Question
                 </button>
               </div>
             </motion.div>
           )}
         </AnimatePresence>
      </div>

      {/* Captions */}
      {currentStep?.narrationText && lessonState === 'playing' && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl text-center z-20 pointer-events-auto">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block bg-zinc-950/80 backdrop-blur-xl px-8 py-5 rounded-2xl border border-white/10 shadow-2xl"
          >
            <div className="flex items-center gap-4">
              <Volume2 className={cn("w-6 h-6 shrink-0", isAudioPlaying ? "text-cyan-400 animate-pulse" : "text-white/40")} />
              <p className="text-white md:text-2xl font-medium tracking-wide drop-shadow-sm leading-relaxed text-left flex-1">
                {currentStep.narrationText.replace(/\[.*?\]/g, '')}
              </p>
              {!currentStep.narration_audio_url && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition shrink-0 font-medium ml-4 pointer-events-auto"
                >
                  Next
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Floating Ask/Resume Button Area */}
      {lessonState !== 'asking' && lessonState !== 'paused' && currentStep?.type === 'question' && (
         <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30">
            <button 
              onClick={(e) => { e.stopPropagation(); openAskScreen(); }}
              className="px-10 py-5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold rounded-full text-xl shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:scale-105 transition-all flex items-center gap-3"
            >
              <Mic className="w-6 h-6" /> Answer / Ask Maya
            </button>
         </div>
      )}

      {/* Teacher Avatar Bottom Right */}
      <div className="absolute bottom-12 right-12 z-40 pointer-events-none hidden md:flex flex-col items-end">
        {currentStep?.humor && lessonState === 'playing' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-zinc-900 border border-white/10 backdrop-blur-md rounded-2xl p-4 shadow-2xl max-w-[280px]"
          >
            <p className="text-cyan-400 text-sm font-semibold mb-1">Maya says:</p>
            <p className="text-white/90 text-sm italic">{currentStep.humor.setup}</p>
          </motion.div>
        )}
        <div className="bg-zinc-900/50 backdrop-blur-lg p-2 rounded-full border border-white/5 shadow-2xl pointer-events-auto">
          <TeacherAvatar 
            emotion={teacherEmotion} 
            isSpeaking={isSpeaking} 
            className="w-32 h-32 md:w-40 md:h-40"
          />
        </div>
      </div>

      {/* Interactive Chat Overlay (Ask Screen) */}
      <AnimatePresence>
        {lessonState === 'asking' && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 h-[65vh] md:h-[60vh] bg-zinc-950 border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-50 flex flex-col"
          >
             <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 bg-zinc-900 shadow-sm z-10 shrink-0">
               <h3 className="text-white font-semibold flex items-center gap-2 text-xl"><MessageCircleQuestion className="w-6 h-6 text-cyan-400"/> Ask Maya</h3>
               <button onClick={handleResume} className="text-zinc-950 hover:bg-cyan-400 px-6 py-2.5 bg-cyan-500 rounded-full text-md transition font-bold shadow-[0_0_20px_rgba(34,211,238,0.2)] flex items-center gap-2">
                 <Play className="w-4 h-4 fill-current"/> Resume Lesson
               </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 md:space-y-8 bg-zinc-950/80">
                {chatHistory.length === 0 && (
                  <div className="text-center text-white/30 mt-16">
                    <TeacherAvatar emotion="curious" isSpeaking={false} className="w-24 h-24 mx-auto mb-4 opacity-70" />
                    <p className="text-xl font-medium">Have a question? Type or use your microphone.</p>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-3xl px-6 py-4 text-lg shadow-xl", msg.role === 'user' ? "bg-cyan-500 text-zinc-950 font-medium rounded-br-sm" : "bg-zinc-800 text-white rounded-bl-sm border border-white/10 leading-relaxed")}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex w-full justify-start">
                    <div className="bg-zinc-800/80 rounded-3xl px-6 py-5 rounded-bl-sm border border-white/10 flex gap-2 shadow-md">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                {error && <div className="text-red-400 text-center p-4 bg-red-400/10 rounded-xl">{error}</div>}
             </div>

             <div className="px-6 py-6 md:px-10 md:py-8 bg-zinc-900 border-t border-white/10 z-10 shrink-0">
                <form onSubmit={submitQuestion} className="flex gap-4 max-w-5xl mx-auto w-full items-center">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder={isTranscribing ? "Transcribing..." : isRecording ? "Listening..." : "Type your question..."}
                      disabled={isRecording || isTranscribing}
                      className={cn(
                        "w-full bg-zinc-950 border border-white/20 rounded-full pl-8 pr-16 py-4 md:py-5 text-white placeholder-white/40 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-lg shadow-inner disabled:opacity-70 transition-all",
                        isRecording && "border-red-500 bg-red-500/10 ring-1 ring-red-500"
                      )}
                    />
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={cn(
                        "absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all focus:outline-none flex items-center justify-center",
                        isRecording ? "text-red-500 hover:bg-white/5" : "text-white/50 hover:text-cyan-400 hover:bg-white/5",
                        isTranscribing && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={isTranscribing}
                      title={isRecording ? "Stop recording" : "Record audio"}
                    >
                      {isRecording ? (
                        <div className="w-6 h-6 rounded-full bg-red-500 animate-pulse border-2 border-red-400" />
                      ) : (
                        <Mic className="w-6 h-6" />
                      )}
                    </button>
                  </div>
                  <button type="submit" disabled={!chatInput.trim() || isChatLoading || isRecording || isTranscribing} className="w-16 h-16 md:w-20 md:h-20 shrink-0 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:bg-cyan-500 text-zinc-950 rounded-full flex items-center justify-center transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                    <Send className="w-7 h-7 md:w-8 md:h-8 -ml-1 text-zinc-950" />
                  </button>
                </form>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}

