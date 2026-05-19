import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Pause, MessageCircleQuestion, Send, Loader2, Volume2, Mic } from 'lucide-react';
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

  const submitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    const userMsgObj = { role: 'user', text: userMsg };
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
             text: userMsg,
             chapterId: topicId
          })
       });

       const contentContext = `Current Step Content: ${steps[currentStepIndex]?.caption || steps[currentStepIndex]?.text || steps[currentStepIndex]?.narrationText || ''}`;
       
       // Import standard generateChatResponse from lib
       const { generateChatResponse } = await import('../lib/gemini');
       const aiResult = await generateChatResponse(userMsg, contentContext, chatHistory as any, { tone: 'Enthusiastic', complexity: 'Intermediate' } as any);

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
           const ttsData = await ttsRes.json();
           if (ttsData.audioUrl && chatAudioRef.current) {
             chatAudioRef.current.src = ttsData.audioUrl;
             chatAudioRef.current.play().catch(e => console.error("Chat TTS play failed", e));
           }
         }
       } catch (err) {
         console.error("Failed to fetch TTS for Chat AI", err);
       }
    } catch(err) {
       console.error(err);
       setIsChatLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 backdrop-blur-md">
         <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto mb-4" />
            <p className="text-white/60 font-medium">Preparing your interactive lesson...</p>
         </div>
      </div>
    );
  }

  const currentStep = steps[currentStepIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col font-sans">
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
      <div className="h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
         <h2 className="text-white font-semibold text-lg drop-shadow-md">{topicTitle}</h2>
         <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition">
           <X className="w-5 h-5"/>
         </button>
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
          className="absolute bottom-8 right-8 w-16 h-16 bg-white hover:bg-zinc-200 text-black rounded-full shadow-2xl flex items-center justify-center z-20 group transition-transform hover:scale-105"
        >
          <Mic className="w-7 h-7 group-hover:text-cyan-600 transition-colors" />
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
            className="absolute bottom-0 left-0 right-0 h-[60vh] bg-zinc-900 border-t border-white/10 rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-30 flex flex-col"
          >
             <div className="flex items-center justify-between p-4 border-b border-white/10">
               <h3 className="text-white font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-cyan-400"/> Ask AI Tutor</h3>
               <button onClick={handleAskQuestionToggle} className="text-white/60 hover:text-white px-4 py-2 bg-white/5 rounded-lg text-sm transition font-medium">
                 Resume Lesson
               </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatHistory.length === 0 && (
                  <div className="text-center text-white/40 mt-10">
                    <MessageCircleQuestion className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Have a question about what we're learning?</p>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[80%] rounded-2xl px-5 py-3", msg.role === 'user' ? "bg-cyan-500 text-black rounded-br-sm" : "bg-zinc-800 text-white rounded-bl-sm border border-white/5")}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex w-full justify-start">
                    <div className="bg-zinc-800 rounded-2xl px-5 py-4 rounded-bl-sm border border-white/5 flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
             </div>

             <div className="p-4 bg-zinc-950 border-t border-white/5">
                <form onSubmit={submitQuestion} className="flex gap-2">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Type your question..."
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-full px-6 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                  />
                  <button type="submit" disabled={!chatInput.trim() || isChatLoading} className="w-12 h-12 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:bg-cyan-500 text-black rounded-full flex items-center justify-center transition-colors">
                    <Send className="w-5 h-5 -ml-0.5" />
                  </button>
                </form>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function Sparkles(props: any) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
}
