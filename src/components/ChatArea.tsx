import React, { useState, useRef, useEffect } from 'react';
import { Chapter, ChatMessage, ReadingPersona } from '../types';
import { Send, Loader2, Sparkles, AlertTriangle, Copy, Check, Trash2, Download, Zap, BookA, Target } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RelationshipGraph from './RelationshipGraph';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { generateChatResponse, generateActionTool } from '../lib/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  chapter: Chapter;
  onClearChats: () => void;
  persona: ReadingPersona;
  onNavigateChapter?: (direction: 'next' | 'prev') => void;
  hasPrevChapter?: boolean;
  hasNextChapter?: boolean;
}

export default function ChatArea({ chapter, onClearChats, persona, onNavigateChapter, hasPrevChapter, hasNextChapter }: Props) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleGenerateAction = async (toolType: 'quiz' | 'glossary' | 'brief') => {
    if (isTyping) return;
    
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
            <div key={i} className="bg-black/20 p-4 rounded-xl border border-white/5">
              <p className="font-medium text-white/90 mb-3">{i + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt: string, optIdx: number) => (
                  <div key={optIdx} className="flex items-start gap-2">
                    <span className="shrink-0 w-5 h-5 rounded bg-white/10 text-[10px] flex items-center justify-center font-bold">{['A','B','C','D'][optIdx] || optIdx + 1}</span>
                    <span className={optIdx === q.answerIndex ? "text-green-400 font-medium" : "text-white/60"}>
                      {opt} {optIdx === q.answerIndex && '✓'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-white/50 bg-white/5 p-2 rounded-md"><span className="font-semibold text-white/70">Explanation:</span> {q.explanation}</p>
            </div>
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] relative w-full max-w-full">
      <div className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 shrink-0 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
        <div className="min-w-0">
          <h2 className="text-sm font-display font-semibold text-white truncate">Chapter {chapter.chapterNumber}: {chapter.title}</h2>
          <p className="text-xs text-white/40 font-light tracking-wide truncate">Context restricted to this chapter</p>
        </div>
        <div className="flex items-center gap-2">
          {onNavigateChapter && (
            <div className="flex items-center bg-black/40 rounded-lg border border-white/5 mr-2 overflow-hidden">
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
          <div className="hidden lg:flex items-center gap-1.5 mr-4 bg-black/40 p-1 rounded-lg border border-white/5">
            <button onClick={() => handleGenerateAction('quiz')} className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-cyan-400 hover:bg-white/5 transition-colors flex items-center gap-1.5" title="Generate practice quiz">
              <Target className="w-3.5 h-3.5" /> Quiz
            </button>
            <button onClick={() => handleGenerateAction('glossary')} className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-emerald-400 hover:bg-white/5 transition-colors flex items-center gap-1.5" title="Extract key terms">
              <BookA className="w-3.5 h-3.5" /> Glossary
            </button>
            <button onClick={() => handleGenerateAction('brief')} className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-amber-400 hover:bg-white/5 transition-colors flex items-center gap-1.5" title="Get an executive briefing">
              <Zap className="w-3.5 h-3.5" /> Briefing
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
        </div>
      </div>

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
                    {msg.type && msg.type !== 'text' ? (
                      <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-2">{msg.text}</p>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    )}
                  </div>
                  {renderActionData(msg)}
                  {msg.role === 'model' && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="absolute top-2 right-2 p-1.5 text-white/30 hover:text-cyan-400 bg-black/20 hover:bg-black/40 rounded-md opacity-0 group-hover/bubble:opacity-100 transition-all"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
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
            className="max-w-4xl mx-auto w-full p-5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3 shadow-sm"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask a question about this chapter..."
              className="w-full max-h-32 md:max-h-40 min-h-[44px] md:min-h-[52px] bg-transparent text-[16px] p-2.5 md:p-3 resize-none focus:outline-none placeholder:text-white/30 text-white font-light custom-scrollbar"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
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
    </div>
  );
}
