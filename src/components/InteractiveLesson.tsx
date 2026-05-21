import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Pause, MessageCircleQuestion, Send, Loader2, Volume2, Mic, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { TeacherAvatar } from './TeacherAvatar';

interface LessonStep {
  id: string;
  type: 'video' | 'image' | 'question';
  url?: string;
  audioUrl?: string;
  narrationText?: string;
  caption?: string;
  text?: string; // For question type
  duration?: number;
  emotion?: 'neutral' | 'smiling' | 'thinking' | 'excited' | 'curious';
  humor?: { setup: string, punchline: string, emotion: string } | null;
}

interface InteractiveLessonProps {
  topicId: string;
  topicTitle: string;
  onClose: () => void;
}

export function InteractiveLesson({ topicId, topicTitle, onClose }: InteractiveLessonProps) {
  const [steps, setSteps] = useState<LessonStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Chat overlay state
  const [isAsking, setIsAsking] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: string, text: string}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  
  // Voice input state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const [chatAudioPlaying, setChatAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const chatAudioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
          setSteps(data.steps);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLesson();
  }, [topicId]);

  useEffect(() => {
    if (steps.length > 0 && !isAsking) {
      playCurrentStep();
    }
  }, [currentStepIndex, steps, isAsking]);

  const playCurrentStep = () => {
    setIsPlaying(true);
    const step = steps[currentStepIndex];
    if (!step) return;

    if (step.audioUrl && audioRef.current) {
      audioRef.current.src = step.audioUrl;
      audioRef.current.play().catch(e => console.error("Audio block:", e));
    }
    
    if (step.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(e => console.error("Video block:", e));
    }
  };

  const pauseCurrentStep = () => {
    setIsPlaying(false);
    if (audioRef.current) audioRef.current.pause();
    if (videoRef.current) videoRef.current.pause();
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleAudioEnded = () => {
    const step = steps[currentStepIndex];
    if (step.type === 'video' && videoRef.current && !videoRef.current.ended) {
      // wait for video
      return;
    }
    handleNext();
  };

  const handleAskQuestionToggle = () => {
    if (isAsking) {
      setIsAsking(false);
      if (chatAudioRef.current) chatAudioRef.current.pause();
      playCurrentStep();
    } else {
      pauseCurrentStep();
      setIsAsking(true);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
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
            setChatInput(data.text);
            // Simulate form submission
            setTimeout(() => {
              submitQuestionWithText(data.text);
            }, 100);
          }
        } catch (err) {
          console.error("Transcription error:", err);
          alert("Sorry, couldn't understand that. Please try again or type your question.");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const submitQuestionWithText = async (textToSubmit: string) => {
    if (!textToSubmit.trim()) return;

    const userMsgObj = { role: 'user', text: textToSubmit };
    setChatInput('');
    setChatHistory(prev => [...prev, userMsgObj]);
    setIsChatLoading(true);

    try {
       const token = localStorage.getItem('token');
       await fetch(`/api/chats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ 
             id: uuidv4(),
             role: 'user',
             text: textToSubmit,
             chapterId: topicId
          })
       });

       const contentContext = `Current Step Content: ${steps[currentStepIndex]?.caption || steps[currentStepIndex]?.text || steps[currentStepIndex]?.narrationText || ''}`;
       
       // Import standard generateChatResponse from lib
       const { generateChatResponse } = await import('../lib/gemini');
       const aiResult = await generateChatResponse(textToSubmit, contentContext, chatHistory as any, { tone: 'Enthusiastic', complexity: 'Intermediate' } as any);

       setChatHistory(prev => [...prev, { role: 'model', text: aiResult.response }]);
       
       await fetch(`/api/chats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ 
             id: uuidv4(),
             role: 'model',
             text: aiResult.response,
             chapterId: topicId
          })
       });

       setIsChatLoading(false);
       
       // Play TTS for AI response
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
      setIsChatLoading(false);
    }
  };

  const submitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    await submitQuestionWithText(chatInput.trim());
  };

  if (isLoading) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/95 backdrop-blur-md">
         <div className="absolute top-6 left-6 z-10">
           <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition flex items-center gap-2 font-medium">
             <ArrowLeft className="w-5 h-5"/> Back
           </button>
         </div>
         <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto mb-4" />
            <p className="text-white/60 font-medium">Preparing your interactive lesson...</p>
         </div>
      </div>,
      document.body
    );
  }

  const currentStep = steps[currentStepIndex];

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col font-sans">
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
      
      {/* Top Header */}
      <div className="h-20 flex items-center justify-between px-4 md:px-8 bg-gradient-to-b from-black/90 to-transparent absolute top-0 left-0 right-0 z-50 pointer-events-none">
         <div className="pointer-events-auto">
           <button onClick={onClose} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all flex items-center gap-2 font-medium backdrop-blur-md border border-white/10 shadow-lg">
             <ArrowLeft className="w-5 h-5"/> Back to Topic
           </button>
         </div>
         <h2 className="text-white font-semibold text-lg md:text-xl drop-shadow-md hidden md:block px-4 py-2 bg-black/40 backdrop-blur rounded-full border border-white/5">{topicTitle}</h2>
         <div className="pointer-events-auto">
           <button onClick={onClose} className="p-3 bg-red-500/80 hover:bg-red-500 rounded-full text-white transition-all shadow-lg shadow-red-500/20 backdrop-blur-md" title="Close Lesson">
             <X className="w-6 h-6"/>
           </button>
         </div>
      </div>

      {/* Teacher Avatar */}
      <div className="absolute top-20 right-6 z-40 pointer-events-none flex flex-col items-center">
        {currentStep?.humor && !isAsking && (
           <motion.div 
             initial={{ opacity: 0, scale: 0 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0 }}
             className="text-2xl mb-2"
           >
             ✨🎉
           </motion.div>
        )}
        <TeacherAvatar 
          emotion={isAsking ? (chatAudioPlaying ? 'smiling' : 'curious') : (currentStep?.emotion || 'neutral')} 
          isSpeaking={isAsking ? chatAudioPlaying : isAudioPlaying} 
          className="w-32 h-32 md:w-40 md:h-40 pointer-events-auto"
        />
        {currentStep?.humor && !isAsking && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 bg-cyan-900/80 backdrop-blur-md rounded-xl p-3 border border-cyan-500/50 shadow-xl max-w-[200px]"
          >
            <p className="text-white text-xs font-semibold">Maya</p>
            <p className="text-white/80 text-[10px] mt-1 italic">{currentStep.humor.setup}</p>
          </motion.div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-20">
         <motion.div 
           className="h-full bg-cyan-400"
           initial={{ width: 0 }}
           animate={{ width: `${((currentStepIndex + 1) / Math.max(steps.length, 1)) * 100}%` }}
           transition={{ duration: 0.3 }}
         />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex items-center justify-center bg-zinc-900 overflow-hidden" onClick={() => isPlaying ? pauseCurrentStep() : playCurrentStep()}>
         {steps.length === 0 ? (
           <p className="text-white/50">No interactive content available for this topic.</p>
         ) : currentStep?.type === 'video' ? (
           <video 
              ref={videoRef}
              src={currentStep.url} 
              className="w-full h-full object-contain"
              playsInline
              onEnded={() => {
                if (audioRef.current && !audioRef.current.ended) return;
                handleNext();
              }}
           />
         ) : currentStep?.type === 'image' ? (
           <img src={currentStep.url} alt="Lesson visual" className="w-full h-full object-contain" />
         ) : currentStep?.type === 'question' ? (
           <div className="max-w-2xl text-center px-6">
              <MessageCircleQuestion className="w-16 h-16 text-cyan-400 mx-auto mb-6" />
              <h3 className="text-3xl font-bold text-white mb-8">{currentStep.text}</h3>
              <button 
                onClick={(e) => { e.stopPropagation(); handleAskQuestionToggle(); }}
                className="px-8 py-4 bg-cyan-500 hover:bg-cyan-600 text-black font-bold rounded-full text-lg shadow-lg hover:shadow-cyan-500/25 transition-all"
              >
                Discuss
              </button>
           </div>
         ) : null}

         {/* Play/Pause indicator overlay briefly */}
         <AnimatePresence>
           {!isPlaying && !isAsking && currentStep?.type !== 'question' && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.2 }}
               className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/40"
             >
               <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                 <Play className="w-10 h-10 text-white translate-x-1" />
               </div>
             </motion.div>
           )}
         </AnimatePresence>
      </div>

      {/* Captions / Narration area */}
      {currentStep?.type !== 'question' && !isAsking && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl text-center z-10 pointer-events-none">
          {currentStep?.narrationText && (
            <div className="inline-block bg-black/70 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 shadow-2xl pointer-events-auto">
              <div className="flex items-center gap-3">
                <Volume2 className={cn("w-5 h-5", isPlaying ? "text-cyan-400 animate-pulse" : "text-white/40")} />
                <p className="text-white md:text-xl font-medium tracking-wide drop-shadow-sm leading-relaxed">
                  {currentStep.narrationText.replace(/\[.*?\]/g, '')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Ask Button */}
      {!isAsking && (
        <button 
          onClick={(e) => { e.stopPropagation(); handleAskQuestionToggle(); }}
          className="absolute bottom-10 md:bottom-12 right-8 md:right-12 w-20 h-20 md:w-24 md:h-24 bg-white hover:bg-zinc-200 text-black rounded-full shadow-[0_10px_40px_rgba(255,255,255,0.3)] flex items-center justify-center z-20 group transition-transform hover:scale-105"
        >
          <Mic className="w-8 h-8 md:w-10 md:h-10 group-hover:text-cyan-600 transition-colors shadow-sm" />
        </button>
      )}

      {/* Interactive Chat Overlay */}
      <AnimatePresence>
        {isAsking && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 h-[65vh] md:h-[50vh] bg-zinc-900 border-t border-white/10 rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-30 flex flex-col"
          >
             <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 bg-zinc-900 shadow-sm z-10">
               <h3 className="text-white font-semibold flex items-center gap-2 text-lg"><Sparkles className="w-5 h-5 text-cyan-400"/> Ask AI Tutor</h3>
               <button onClick={handleAskQuestionToggle} className="text-white/80 hover:text-white px-5 py-3 bg-white/10 rounded-xl text-md transition font-medium backdrop-blur border border-white/5 shadow-sm">
                 Resume Lesson
               </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 bg-zinc-900/50">
                {chatHistory.length === 0 && (
                  <div className="text-center text-white/40 mt-10">
                    <MessageCircleQuestion className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg md:text-xl font-medium">Have a question about what we're learning?</p>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-3xl px-6 py-4 text-base md:text-lg shadow-md", msg.role === 'user' ? "bg-cyan-500 text-black rounded-br-sm" : "bg-zinc-800 text-white rounded-bl-sm border border-white/5")}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex w-full justify-start">
                    <div className="bg-zinc-800 rounded-3xl px-6 py-5 rounded-bl-sm border border-white/5 flex gap-2 shadow-md">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
             </div>

             <div className="p-4 md:p-6 bg-zinc-950 border-t border-white/5 z-10 pb-8 md:pb-8">
                <form onSubmit={submitQuestion} className="flex gap-2 max-w-4xl mx-auto w-full items-center">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder={isTranscribing ? "Transcribing..." : isRecording ? "Listening..." : "Type your question..."}
                      disabled={isRecording || isTranscribing}
                      className={cn(
                        "w-full bg-zinc-900 border border-white/10 rounded-full pl-6 pr-14 py-4 text-white placeholder-white/40 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-lg shadow-inner disabled:opacity-70",
                        isRecording && "border-red-500 bg-red-500/5 ring-1 ring-red-500"
                      )}
                    />
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full transition-all focus:outline-none flex items-center justify-center",
                        isRecording ? "text-red-500 hover:bg-white/5" : "text-white/60 hover:text-white hover:bg-white/5",
                        isTranscribing && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={isTranscribing}
                      title={isRecording ? "Stop recording" : "Record audio using voice"}
                    >
                      {isRecording ? (
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-red-500 animate-pulse" />
                      ) : (
                        <Mic className="w-5 h-5 md:w-6 md:h-6" />
                      )}
                    </button>
                  </div>
                  <button type="submit" disabled={!chatInput.trim() || isChatLoading || isRecording || isTranscribing} className="w-14 h-14 md:w-16 md:h-16 shrink-0 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:bg-cyan-500 text-black rounded-full flex items-center justify-center transition-colors shadow-lg">
                    <Send className="w-6 h-6 md:w-7 md:h-7 -ml-1 text-black" />
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

function Sparkles(props: any) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
}
