import React, { useState, useRef, useEffect } from 'react';
import { Chapter, ChatMessage, ReadingPersona } from '../types';
import { Send, Loader2, Sparkles, AlertTriangle, Copy, Check, Trash2, Download, CloudDownload, Zap, BookA, Target, Video, Film, MessageCircleQuestion, X, PlayCircle, Wand2, Pin, PinOff, Volume2, Square, FastForward } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RelationshipGraph from './RelationshipGraph';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { generateChatResponse, generateActionTool } from '../lib/gemini';
import StoryboardScreen from './storyboard/StoryboardScreen';
import { ImageSearchButton } from './ImageSearchButton';
import { ScrollableActionBar } from './ScrollableActionBar';
import { ImageCard } from './ImageCard';
import { InteractiveLesson } from './InteractiveLesson';
import { BetaBadge } from './BetaBadge';

import { useAuth } from '../contexts/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const QuizQuestion = ({ q, index }: { q: any, index: number }) => {
  const [showAnswer, setShowAnswer] = useState(false);
  
  return (
    <div className="bg-black/20 p-4 rounded-xl border border-white/5">
      <p className="font-medium text-white/90 mb-3">{index + 1}. {q.question}</p>
      <div className="space-y-2">
        {q.options.map((opt: string, optIdx: number) => {
          const isCorrect = optIdx === q.answerIndex;
          const isSelectedCorrect = showAnswer && isCorrect;
          return (
            <div key={optIdx} className="flex items-start gap-2">
              <span className="shrink-0 w-5 h-5 rounded bg-white/10 text-[10px] flex items-center justify-center font-bold">{['A','B','C','D'][optIdx] || optIdx + 1}</span>
              <span className={isSelectedCorrect ? "text-green-400 font-medium" : "text-white/60"}>
                {opt} {isSelectedCorrect && '✓'}
              </span>
            </div>
          );
        })}
      </div>
      {!showAnswer ? (
        <button 
          onClick={() => setShowAnswer(true)}
          className="mt-4 text-xs font-medium px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
        >
          Show Answer
        </button>
      ) : (
        <p className="mt-3 text-xs text-white/50 bg-white/5 p-2 rounded-md"><span className="font-semibold text-white/70">Explanation:</span> {q.explanation}</p>
      )}
    </div>
  );
};

interface Props {
  chapter: Chapter;
  onClearChats: () => void;
  persona: ReadingPersona;
  onNavigateChapter?: (direction: 'next' | 'prev') => void;
  hasPrevChapter?: boolean;
  hasNextChapter?: boolean;
  isStudent?: boolean;
}

const EMOJIS = ['👍', '👎', '❤️', '😂', '😮', '🔖'];

function YouTubeVideo({ video }: { video: { title: string, video_id: string } }) {
  const [captions, setCaptions] = useState<any[] | null>(null);
  const [showCC, setShowCC] = useState(false);
  const [loadingCC, setLoadingCC] = useState(false);

  const toggleCC = async () => {
    if (!showCC && !captions) {
      setLoadingCC(true);
      try {
        const res = await fetch(`/api/youtube/${video.video_id}/captions`);
        if (res.ok) {
          const data = await res.json();
          setCaptions(data);
        }
      } catch (err) {
        console.error('Failed to load captions', err);
      } finally {
        setLoadingCC(false);
      }
    }
    setShowCC(!showCC);
  };

  return (
    <div className="bg-black/20 rounded-xl overflow-hidden border border-white/5 flex flex-col hover:border-cyan-500/30 transition-colors shadow-xl relative aspect-video flex-shrink-0 min-w-[280px]">
      <div className="aspect-video bg-black relative">
        <iframe 
          src={`https://www.youtube.com/embed/${video.video_id}`} 
          title={video.title} 
          className="w-full h-full absolute inset-0 border-0"
          allowFullScreen
        />
        <button 
          onClick={toggleCC}
          className={cn(
            "absolute top-2 right-2 p-1.5 rounded text-xs font-bold transition-colors z-10 shadow-lg backdrop-blur-md border",
            showCC ? "bg-cyan-500 text-white border-cyan-400" : "bg-black/60 text-white/70 border-white/20 hover:text-white hover:bg-black/80"
          )}
        >
          {loadingCC ? '...' : 'CC'}
        </button>
      </div>
      {showCC && captions && (
        <div className="bg-black/90 p-3 max-h-[150px] overflow-y-auto w-full text-xs text-white/80 border-t border-white/10 custom-scrollbar absolute bottom-0 left-0 z-20">
          {captions.length > 0 ? captions.map((c, i) => (
            <span key={i} className="mr-1">{c.text}</span>
          )) : (
            <p className="opacity-50 italic">No captions available.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatArea({ chapter, onClearChats, persona, onNavigateChapter, hasPrevChapter, hasNextChapter, isStudent }: Props) {
  const { user, isOffline } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'video'>('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [isGeneratingFollowUps, setIsGeneratingFollowUps] = useState(false);
  const [showInteractiveLesson, setShowInteractiveLesson] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement>(null);
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me/context')
      .then(res => {
         if (res.ok) return res.json();
      })
      .then(data => {
        if (data && data.orgName) {
          setOrgName(data.orgName);
        }
      })
      .catch(() => {});
  }, []);

  const handlePlayTTS = async (msg: ChatMessage) => {
    if (playingMessageId === msg.id) {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      }
      setPlayingMessageId(null);
      return;
    }

    try {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
      }
      setPlayingMessageId(msg.id);
      setIsTtsLoading(true);
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.text })
      });
      if (!res.ok) throw new Error('TTS failed');
      const data = await res.json();
      
      if (ttsAudioRef.current) {
        ttsAudioRef.current.src = data.audioUrl;
        ttsAudioRef.current.playbackRate = playbackRate;
        await ttsAudioRef.current.play();
      }
    } catch(err) {
      console.error(err);
      setPlayingMessageId(null);
    } finally {
      setIsTtsLoading(false);
    }
  };

  const handleTogglePin = async (msg: ChatMessage) => {
    try {
      const pinValue = !msg.pinned;
      const res = await fetch(`/api/chats/${msg.id}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: pinValue })
      });
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pinned: pinValue } : m));
      }
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setMessages([]);
    setError(null);
    setIsTyping(false);
    
    if (chapter.id.startsWith('lib_')) {
      return; // It's a virtual cross-document chapter, do not load from DB
    }

    fetch(`/api/chats/${chapter.id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load chat history');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data);
        }
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load chat history.');
      });
  }, [chapter.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReact = async (messageId: string, emoji: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const currentReactions = msg.reactions || {};
        const emojiUsers = currentReactions[emoji] || [];
        const isReacted = user && emojiUsers.includes(user.id);
        const newReactions = { ...currentReactions };
        if (isReacted) {
          newReactions[emoji] = emojiUsers.filter(id => id !== user?.id);
        } else {
          newReactions[emoji] = [...emojiUsers, user?.id || ''];
        }
        return { ...msg, reactions: newReactions };
      }
      return msg;
    }));

    if (!chapter.id.startsWith('lib_')) {
      try {
        const res = await fetch(`/api/chats/${messageId}/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji })
        });
        if (!res.ok) throw new Error('Failed to react');
        const data = await res.json();
        if (data.reactions) {
          setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, reactions: data.reactions } : msg));
        }
      } catch (err) {
        console.error('Reaction error:', err);
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    
    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setError(null);

    // Save user message to DB
    if (!chapter.id.startsWith('lib_')) {
      fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userMsg, chapterId: chapter.id })
      }).catch(console.error);
    }

    try {
      const aiResult = await generateChatResponse(text, chapter.content, messages, persona);
      
      const aiMsg: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        text: aiResult.response,
        relationshipGraph: aiResult.relationshipGraph,
        followUps: aiResult.followUpQuestions
      };

      setMessages(prev => [...prev, aiMsg]);

      // Save AI message to DB
      if (!chapter.id.startsWith('lib_')) {
        fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...aiMsg, chapterId: chapter.id })
        }).catch(console.error);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate response.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleFetchImages = async () => {
    if (isTyping) return;
    
    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', text: "Find educational images for this chapter." };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setError(null);

    if (!chapter.id.startsWith('lib_')) {
      fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userMsg, chapterId: chapter.id })
      }).catch(console.error);
    }

    try {
      const response = await fetch(`/api/topics/${chapter.id}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: chapter.title,
          summary: chapter.summary,
          key_concepts: (chapter as any).key_concepts || [],
          org_context: orgName || user?.name || 'General Education'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch images');
      }

      window.dispatchEvent(new Event('usage-updated'));
      const data = await response.json();
      const imagesArray = data.images || [];
      
      let aiMsg: ChatMessage;
      
      if (imagesArray.length === 0) {
        aiMsg = {
          id: uuidv4(),
          role: 'model',
          text: `I couldn't find any images for this topic. Would you like me to find related videos instead?`,
          type: 'text' // We can just make it text, and user can click the video button.
        };
        // We'll append a button using Markdown or provide a UI element.
        // Or simply text "I couldn't find any images for this topic. Click 'Videos' below to find related videos instead."
        // The instructions ask for "a friendly message: 'I couldn't find any images for this topic. Would you like me to find related videos instead?' with a clickable link to trigger the video search."
        aiMsg.text = "I couldn't find any images for this topic. Would you like me to find related videos instead?";
        aiMsg.type = "image_fallback"; // Let's use a custom type so we can render a clickable link button.
      } else {
        aiMsg = {
          id: uuidv4(),
          role: 'model',
          text: 'Here are some helpful images and diagrams for this chapter.',
          type: 'images',
          images: imagesArray
        };
      }

      setMessages(prev => [...prev, aiMsg]);

      if (!chapter.id.startsWith('lib_')) {
        fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...aiMsg, chapterId: chapter.id })
        }).catch(console.error);
      }

    } catch (err: any) {
      console.error(err);
      setError('Could not find images. Please try again later.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleGenerateVideoLesson = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/chapters/${chapter.id}/generate-lesson`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ org_id: 'default' })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to start video generation.');
        return;
      }
      window.dispatchEvent(new Event('usage-updated'));
      
      // Successfully started, switch to video tab
      setActiveTab('video');
    } catch (err: any) {
      console.error(err);
      setError('An error occurred while starting video generation.');
    }
  };

  const handleFetchVideos = async () => {
    if (isTyping) return;
    
    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', text: "Find educational videos for this chapter." };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setError(null);

    // Save user message to DB
    if (!chapter.id.startsWith('lib_')) {
      fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userMsg, chapterId: chapter.id })
      }).catch(console.error);
    }

    try {
      const response = await fetch('/api/retrieve-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: chapter.title,
          summary: chapter.summary,
          subject: 'General Education',
          grade: 'High School',
          keyConcepts: (chapter as any).key_concepts || [],
          class_context: (document.cookie.includes('sb-org-id=') && orgName) ? orgName : "",
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch videos');
      }

      window.dispatchEvent(new Event('usage-updated'));
      const data = await response.json();
      
      const aiMsg: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        text: 'Here are some highly recommended videos for this chapter.',
        type: 'videos',
        recommended_videos: data.recommended_videos || []
      };

      setMessages(prev => [...prev, aiMsg]);

      if (!chapter.id.startsWith('lib_')) {
        fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...aiMsg, chapterId: chapter.id })
        }).catch(console.error);
      }

    } catch (err: any) {
      console.error(err);
      setError('Could not find recommended videos. Please try again later.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleGenerateFollowUps = async () => {
    if (followUpQuestions.length > 0) {
      setShowFollowUpModal(true);
      return;
    }
    
    if (!chapter.content || chapter.content.trim() === '') {
      setError("This topic does not have enough content to generate follow-ups.");
      return;
    }

    setIsGeneratingFollowUps(true);
    setShowFollowUpModal(true);
    try {
      const aiResult = await generateActionTool(chapter.content, 'followup');
      if (aiResult && aiResult.questions) {
        setFollowUpQuestions(aiResult.questions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingFollowUps(false);
    }
  };

  const handleGenerateAction = async (toolType: 'quiz' | 'glossary' | 'brief') => {
    if (isTyping) return;
    
    if (!chapter.content || chapter.content.trim() === '') {
      setError("This topic does not have enough content to generate actions.");
      return;
    }

    let text = "";
    if (toolType === 'quiz') text = "Generate a multiple-choice Quiz.";
    else if (toolType === 'glossary') text = "Generate a Glossary of Key Terms.";
    else if (toolType === 'brief') text = "Generate an Executive Briefing.";

    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setError(null);

    if (!chapter.id.startsWith('lib_')) {
      fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userMsg, chapterId: chapter.id })
      }).catch(console.error);
    }

    try {
      const aiResult = await generateActionTool(chapter.content, toolType);
      
      const aiMsg: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        text: `Here is the requested ${toolType}.`,
        type: toolType,
        actionData: aiResult
      };

      setMessages(prev => [...prev, aiMsg]);

      if (!chapter.id.startsWith('lib_')) {
        fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...aiMsg, chapterId: chapter.id })
        }).catch(console.error);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || `Failed to generate ${toolType}.`);
    } finally {
      setIsTyping(false);
    }
  };

  const renderActionData = (msg: ChatMessage) => {
    if (!msg.actionData) return null;
    
    if (msg.type === 'quiz') {
      const questions = msg.actionData.questions || [];
      return (
        <div className="mt-4 space-y-4">
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Target className="w-4 h-4" /> Practice Quiz</h3>
          {questions.map((q: any, i: number) => (
            <QuizQuestion key={i} q={q} index={i} />
          ))}
        </div>
      );
    } else if (msg.type === 'glossary') {
      const terms = msg.actionData.terms || [];
      return (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2"><BookA className="w-4 h-4" /> Glossary of Terms</h3>
          {terms.map((t: any, i: number) => (
            <div key={i} className="flex flex-col md:flex-row gap-2 bg-black/20 border border-white/5 rounded-lg p-3">
              <span className="font-semibold text-emerald-300 md:w-1/3 shrink-0">{t.term}</span>
              <span className="text-white/70 text-sm">{t.definition}</span>
            </div>
          ))}
        </div>
      );
    } else if (msg.type === 'brief') {
      const { summaryMemo, actionItems = [], keyArguments = [] } = msg.actionData;
      return (
        <div className="mt-4 space-y-5">
          <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Zap className="w-4 h-4" /> Executive Briefing</h3>
          <div className="bg-amber-400/5 border border-amber-400/20 p-4 rounded-xl">
            <h4 className="text-xs uppercase tracking-wide text-amber-400 mb-2 font-semibold">Memo</h4>
            <p className="text-sm text-white/80 leading-relaxed">{summaryMemo}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-black/20 border border-white/5 p-4 rounded-xl">
              <h4 className="text-xs uppercase tracking-wide text-white/40 mb-3 font-semibold">Key Arguments</h4>
              <ul className="space-y-2">
                {keyArguments.map((arg: string, i: number) => (
                  <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                    <span className="text-amber-400 mt-1">•</span> <span>{arg}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-black/20 border border-white/5 p-4 rounded-xl">
              <h4 className="text-xs uppercase tracking-wide text-white/40 mb-3 font-semibold">Action Items</h4>
              <ul className="space-y-2">
                {actionItems.map((item: string, i: number) => (
                  <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                    <span className="text-amber-400 mt-1">→</span> <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  useEffect(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] relative w-full max-w-full">
      <audio 
        ref={ttsAudioRef} 
        onEnded={() => setPlayingMessageId(null)}
        onError={() => setPlayingMessageId(null)}
        className="hidden"
      />
      <div className="flex flex-col lg:flex-row lg:items-center justify-between px-4 md:px-8 py-3 lg:py-0 lg:h-16 shrink-0 bg-[#0a0a0a]/80 backdrop-blur-md z-10 gap-3 border-b border-white/5">
        <div className="min-w-0 shrink-0">
          <h2 className="text-sm font-display font-semibold text-white truncate">Chapter {chapter.chapterNumber}: {chapter.title}</h2>
          <p className="text-xs text-white/40 font-light tracking-wide truncate">Context restricted to this chapter</p>
        </div>
        <ScrollableActionBar className="w-full lg:w-auto pb-1 lg:pb-0 min-w-0" innerClassName="gap-2">
          <div className="flex items-center shrink-0 bg-black/40 rounded-lg border border-white/5 p-1 mr-2 gap-1">
             <Volume2 className="w-3.5 h-3.5 text-white/40 ml-1" />
             <select 
               value={playbackRate} 
               onChange={e => setPlaybackRate(Number(e.target.value))}
               className="bg-transparent text-xs text-white/80 font-medium focus:outline-none appearance-none px-2"
             >
               <option value={1}>1x</option>
               <option value={1.25}>1.25x</option>
               <option value={1.5}>1.5x</option>
             </select>
          </div>
          {onNavigateChapter && (
            <div className="flex items-center shrink-0 bg-black/40 rounded-lg border border-white/5 overflow-hidden">
              <button 
                onClick={() => onNavigateChapter('prev')}
                disabled={!hasPrevChapter}
                className="px-3 py-1.5 text-xs font-medium text-white/60 hover:text-cyan-400 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous Chapter"
              >
                Prev
              </button>
              <div className="w-px h-4 bg-white/10" />
              <button 
                onClick={() => onNavigateChapter('next')}
                disabled={!hasNextChapter}
                className="px-3 py-1.5 text-xs font-medium text-white/60 hover:text-cyan-400 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next Chapter"
              >
                Next
              </button>
            </div>
          )}
          <div className={cn("flex items-center shrink-0 gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5 pr-2", isOffline && "opacity-50 pointer-events-none")}>
            {!isStudent && (
              <button 
                onClick={() => setShowInteractiveLesson(true)}
                className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                title="Start Interactive Lesson"
              >
                <PlayCircle className="w-3.5 h-3.5" /> Interactive Lesson <BetaBadge />
              </button>
            )}
            <button 
              onClick={() => setActiveTab(activeTab === 'chat' ? 'video' : 'chat')} 
              className={cn("text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0", activeTab === 'video' ? 'bg-cyan-500/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/5')}
              title="Toggle Video Lesson Pipeline"
            >
              <Film className="w-3.5 h-3.5" /> Pipeline
            </button>
            {!isStudent && (
              <button 
                onClick={handleGenerateVideoLesson} 
                className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-indigo-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0"
                title="Generate AI video lesson"
              >
                <Wand2 className="w-3.5 h-3.5" /> Generate Video <BetaBadge />
              </button>
            )}
            <button onClick={handleFetchVideos} className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-red-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0" title="Find educational videos">
              <Video className="w-3.5 h-3.5" /> Videos
            </button>
            {!isStudent && (
              <ImageSearchButton onClick={handleFetchImages} isLoading={isTyping} />
            )}
            <button onClick={() => handleGenerateAction('quiz')} className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-cyan-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0" title="Generate practice quiz">
              <Target className="w-3.5 h-3.5" /> Quiz
            </button>
            <button onClick={() => handleGenerateAction('glossary')} className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-emerald-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0" title="Extract key terms">
              <BookA className="w-3.5 h-3.5" /> Glossary
            </button>
            <button onClick={() => handleGenerateAction('brief')} className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-amber-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0" title="Get an executive briefing">
              <Zap className="w-3.5 h-3.5" /> Briefing
            </button>
            <button onClick={handleGenerateFollowUps} className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-purple-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0" title="Get Follow-up Questions">
              <MessageCircleQuestion className="w-3.5 h-3.5" /> Follow-ups
            </button>
            <button 
              onClick={async () => {
                const lib = await import('../lib/offline');
                await lib.cacheWholeTopic(chapter);
                alert('Chapter is now available offline');
              }} 
              className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-cyan-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0" 
              title="Make available offline"
            >
              <CloudDownload className="w-3.5 h-3.5" /> Save Offline
            </button>
          </div>
          <button
            onClick={() => {
              const content = messages.map(m => `${m.role === 'user' ? 'You' : 'AI'}:\n${m.text}`).join('\n\n---\n\n');
              const blob = new Blob([content], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `chat-${chapter.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="p-2 text-white/40 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
            title="Export chat history"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">Export Chat</span>
          </button>
          <button
            onClick={onClearChats}
            className="p-2 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
            title="Clear all chats for this document"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">Clear Chats</span>
          </button>
        </ScrollableActionBar>
      </div>

      {activeTab === 'video' ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-0">
          <StoryboardScreen chapterId={chapter.id} isStudent={isStudent} />
        </div>
      ) : (
      <>
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 custom-scrollbar relative z-0">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex gap-3 md:gap-6 max-w-4xl mx-auto w-full"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-3 pt-1 min-w-0">
            <p className="text-xs font-display font-semibold text-cyan-400 tracking-widest uppercase">Chapter Summary</p>
            <div className="prose prose-invert prose-sm max-w-none text-white/70 leading-relaxed font-light break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{chapter.summary}</ReactMarkdown>
            </div>
          </div>
        </motion.div>

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div 
              key={msg.id} 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={cn("flex gap-3 md:gap-6 max-w-4xl mx-auto w-full group", msg.role === 'user' ? "flex-row-reverse" : "")}
            >
              <div className={cn(
                "w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg text-sm md:text-base",
                msg.role === 'user' 
                  ? "bg-white/10 text-white border border-white/20" 
                  : "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
              )}>
                {msg.role === 'user' ? 'U' : <Sparkles className="w-4 h-4 md:w-5 md:h-5" />}
              </div>
              <div className={cn("flex-1 space-y-4 md:space-y-5 min-w-0", msg.role === 'user' ? "text-right" : "")}>
                <div className={cn(
                  "inline-block p-4 md:p-5 rounded-2xl max-w-[90%] md:max-w-[85%] text-left shadow-sm overflow-hidden relative group/bubble transition-colors",
                  msg.role === 'user' 
                    ? "bg-white/5 border border-white/10 text-white rounded-tr-sm hover:bg-white/10" 
                    : "bg-transparent text-white/80 hover:bg-white/[0.02]"
                )}>
                  <div className="prose prose-invert prose-sm max-w-none font-light leading-relaxed break-words">
                    {msg.type && msg.type !== 'text' && msg.type !== 'image_fallback' ? (
                      <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-2">{msg.text}</p>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    )}
                  </div>
                  {msg.type === 'image_fallback' && (
                    <div className="mt-4">
                      <button 
                        onClick={handleFetchVideos}
                        className="text-xs font-medium px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 border border-white/10"
                      >
                        <Video className="w-4 h-4" /> Find Related Videos
                      </button>
                    </div>
                  )}
                  {renderActionData(msg)}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleTogglePin(msg)}
                      className={cn("p-1.5 rounded-md transition-all", msg.pinned ? "text-cyan-400 bg-cyan-500/20" : "text-white/30 hover:text-cyan-400 bg-black/20 hover:bg-black/40")}
                      title={msg.pinned ? "Unpin message" : "Pin message"}
                    >
                      {msg.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>
                    {msg.role === 'model' && (
                      <button
                        onClick={() => handlePlayTTS(msg)}
                        className="p-1.5 text-white/30 hover:text-cyan-400 bg-black/20 hover:bg-black/40 rounded-md transition-all"
                        title={playingMessageId === msg.id ? "Stop TTS" : "Play TTS"}
                      >
                        {isTtsLoading && playingMessageId === msg.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : playingMessageId === msg.id ? (
                          <Square className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    {msg.role === 'model' && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="p-1.5 text-white/30 hover:text-cyan-400 bg-black/20 hover:bg-black/40 rounded-md transition-all"
                        title="Copy response"
                      >
                        {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  {msg.pinned && (
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)] border-2 border-[#0a0a0a]" title="Pinned Message" />
                  )}
                </div>

                <div className={cn("flex flex-wrap gap-1.5 mt-1", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  {EMOJIS.map(emoji => {
                    const count = msg.reactions?.[emoji]?.length || 0;
                    const isReacted = user && msg.reactions?.[emoji]?.includes(user.id);
                    if (count === 0) return (
                      <button key={emoji} onClick={() => handleReact(msg.id, emoji)} className="opacity-0 group-hover:opacity-100 transition-opacity text-sm p-1 hover:scale-125 focus:opacity-100 grayscale hover:grayscale-0">{emoji}</button>
                    );
                    return (
                      <button key={emoji} onClick={() => handleReact(msg.id, emoji)} className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors", isReacted ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-400" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10")}>
                        <span>{emoji}</span><span className="text-[10px]">{count}</span>
                      </button>
                    );
                  })}
                </div>

                {msg.recommended_videos && msg.recommended_videos.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 text-left"
                  >
                    <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2 mb-4">
                      Recommended Videos
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {msg.recommended_videos.map((video, vIdx) => (
                        <div key={vIdx} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden flex flex-col">
                          <YouTubeVideo video={video} />
                          <div className="p-3 flex flex-col flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-sm font-medium text-white line-clamp-2" title={video.title}>{video.title}</h4>
                              <span className="shrink-0 bg-cyan-500/20 text-cyan-400 text-xs px-2 py-0.5 rounded font-medium">
                                Score: {video.quality_score}
                              </span>
                            </div>
                            <p className="text-xs text-white/50 mb-2 truncate">{video.channel}</p>
                            <p className="text-xs text-white/70 italic line-clamp-3 flex-1">{video.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {msg.images && msg.images.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 text-left"
                  >
                    <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2 mb-4">
                      Images & Diagrams
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {msg.images.map((img, iIdx) => (
                        <ImageCard key={iIdx} image={img} />
                      ))}
                    </div>
                  </motion.div>
                )}

                {msg.relationshipGraph && msg.relationshipGraph.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 text-left bg-white/[0.02] border border-white/5 rounded-xl p-5"
                  >
                    <p className="text-xs font-display font-semibold text-cyan-400 tracking-widest uppercase mb-4">Relationship Graph</p>
                    <RelationshipGraph data={msg.relationshipGraph} />
                  </motion.div>
                )}

                {msg.followUps && msg.followUps.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6 space-y-3 text-left"
                  >
                    <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Suggested follow-ups</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.followUps.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendMessage(q)}
                          className="text-xs px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-400 transition-all duration-300 text-left shadow-sm hover:shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex gap-3 md:gap-6 max-w-4xl mx-auto w-full"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
              <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
            </div>
            <div className="flex-1 flex items-center pt-2">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto w-full p-5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex flex-col items-start gap-3 shadow-sm"
          >
            <div className="flex gap-3 items-start w-full">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
            {error.includes("Upgrade") && (
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-pricing'))}
                className="mt-1 ml-8 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-white rounded text-xs border border-red-500/30 transition-colors font-medium cursor-pointer"
              >
                Upgrade Plan
              </button>
            )}
          </motion.div>
        )}
        
        <div ref={messagesEndRef} className="h-4" />
      </div>

      <div className="p-4 md:p-6 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent shrink-0 relative z-10">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 md:gap-3 bg-white/5 border border-white/10 rounded-2xl p-1.5 md:p-2 focus-within:border-cyan-500/50 focus-within:bg-white/[0.07] transition-all duration-300 shadow-lg backdrop-blur-sm">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isOffline}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={isOffline ? "Chat is unavailable offline" : "Ask a question about this chapter..."}
              className="w-full max-h-32 md:max-h-40 min-h-[44px] md:min-h-[52px] bg-transparent text-[16px] p-2.5 md:p-3 resize-none focus:outline-none placeholder:text-white/30 text-white font-light custom-scrollbar disabled:opacity-50"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping || isOffline}
              className="p-2.5 md:p-3.5 rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shrink-0 shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] disabled:shadow-none"
            >
              <Send className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </form>
          <p className="text-center text-[10px] md:text-xs text-white/30 mt-2 md:mt-3 font-light tracking-wide px-2">
            AI can make mistakes. Consider verifying important information.
          </p>
        </div>
      </div>
      </>
      )}

      <AnimatePresence>
        {showFollowUpModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <MessageCircleQuestion className="w-5 h-5 text-purple-400" /> Follow-up Questions
                </h3>
                <button onClick={() => setShowFollowUpModal(false)} className="text-white/40 hover:text-white px-2 py-1 rounded-md hover:bg-white/10">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {isGeneratingFollowUps ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                     <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                     <p className="text-sm text-white/50">Generating curated questions...</p>
                  </div>
                ) : (
                  followUpQuestions.map((q, i) => (
                     <button
                        key={i}
                        onClick={() => {
                           setShowFollowUpModal(false);
                           handleSendMessage(q);
                        }}
                        className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl text-sm text-white/80 transition-all font-medium hover:border-purple-500/30 line-clamp-2"
                     >
                        {q}
                     </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInteractiveLesson && (
          <InteractiveLesson 
            topicId={chapter.id} 
            topicTitle={chapter.title} 
            onClose={() => setShowInteractiveLesson(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
