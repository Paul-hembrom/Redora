import React, { useState, useRef, useEffect } from 'react';
import { Chapter, ChatMessage } from '../types';
import { Send, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RelationshipGraph from './RelationshipGraph';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { generateChatResponse } from '../lib/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  chapter: Chapter;
}

export default function ChatArea({ chapter }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
    setIsTyping(false);
    
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

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    
    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setError(null);

    // Save user message to DB
    fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userMsg, chapterId: chapter.id })
    }).catch(console.error);

    try {
      const aiResult = await generateChatResponse(text, chapter.content, messages);
      
      const aiMsg: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        text: aiResult.response,
        relationshipGraph: aiResult.relationshipGraph,
        followUps: aiResult.followUpQuestions
      };

      setMessages(prev => [...prev, aiMsg]);

      // Save AI message to DB
      fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...aiMsg, chapterId: chapter.id })
      }).catch(console.error);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate response.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] relative">
      <div className="h-16 border-b border-white/5 flex items-center px-8 shrink-0 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
        <div>
          <h2 className="text-sm font-display font-semibold text-white">Chapter {chapter.chapterNumber}: {chapter.title}</h2>
          <p className="text-xs text-white/40 font-light tracking-wide">Context restricted to this chapter</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar relative z-0">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex gap-6 max-w-4xl mx-auto w-full"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-3 pt-1">
            <p className="text-xs font-display font-semibold text-cyan-400 tracking-widest uppercase">Chapter Summary</p>
            <div className="prose prose-invert prose-sm max-w-none text-white/70 leading-relaxed font-light">
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
              className={cn("flex gap-6 max-w-4xl mx-auto w-full", msg.role === 'user' ? "flex-row-reverse" : "")}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg",
                msg.role === 'user' 
                  ? "bg-white/10 text-white border border-white/20" 
                  : "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
              )}>
                {msg.role === 'user' ? 'U' : <Sparkles className="w-5 h-5" />}
              </div>
              <div className={cn("flex-1 space-y-5", msg.role === 'user' ? "text-right" : "")}>
                <div className={cn(
                  "inline-block p-5 rounded-2xl max-w-[85%] text-left shadow-sm",
                  msg.role === 'user' 
                    ? "bg-white/5 border border-white/10 text-white rounded-tr-sm" 
                    : "bg-transparent text-white/80"
                )}>
                  <div className="prose prose-invert prose-sm max-w-none font-light leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                  </div>
                </div>

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
            className="flex gap-6 max-w-4xl mx-auto w-full"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
              <Loader2 className="w-5 h-5 animate-spin" />
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
            className="max-w-4xl mx-auto w-full p-5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3 shadow-sm"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} className="h-4" />
      </div>

      <div className="p-6 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent shrink-0 relative z-10">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-3 bg-white/5 border border-white/10 rounded-2xl p-2 focus-within:border-cyan-500/50 focus-within:bg-white/[0.07] transition-all duration-300 shadow-lg backdrop-blur-sm">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask a question about this chapter..."
              className="w-full max-h-40 min-h-[52px] bg-transparent text-base p-3 resize-none focus:outline-none placeholder:text-white/30 text-white font-light custom-scrollbar"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="p-3.5 rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shrink-0 shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] disabled:shadow-none"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <p className="text-center text-xs text-white/30 mt-3 font-light tracking-wide">
            AI can make mistakes. Consider verifying important information.
          </p>
        </div>
      </div>
    </div>
  );
}
