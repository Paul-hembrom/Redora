import React, { useState, useRef, useEffect } from 'react';
import { Chapter, ChatMessage } from '../types';
import { Send, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RelationshipGraph from './RelationshipGraph';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  chapter: Chapter;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isTyping: boolean;
  error: string | null;
}

export default function ChatArea({ chapter, messages, onSendMessage, isTyping, error }: Props) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0a]">
      <div className="h-16 border-b border-neutral-800 flex items-center px-6 shrink-0 bg-[#0f0f0f]">
        <div>
          <h2 className="text-sm font-semibold text-neutral-200">Chapter {chapter.chapterNumber}: {chapter.title}</h2>
          <p className="text-xs text-neutral-500 font-mono">Context restricted to this chapter</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex gap-4 max-w-3xl mx-auto w-full">
          <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-xs font-mono text-emerald-400">CHAPTER SUMMARY</p>
            <div className="prose prose-invert prose-sm max-w-none text-neutral-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{chapter.summary}</ReactMarkdown>
            </div>
          </div>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-4 max-w-3xl mx-auto w-full", msg.role === 'user' ? "flex-row-reverse" : "")}>
            <div className={cn(
              "w-8 h-8 rounded flex items-center justify-center shrink-0",
              msg.role === 'user' 
                ? "bg-neutral-800 text-neutral-300" 
                : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
            )}>
              {msg.role === 'user' ? 'U' : <Sparkles className="w-4 h-4" />}
            </div>
            <div className={cn("flex-1 space-y-4", msg.role === 'user' ? "text-right" : "")}>
              <div className={cn(
                "inline-block p-4 rounded-2xl max-w-full text-left",
                msg.role === 'user' 
                  ? "bg-neutral-800 text-neutral-200 rounded-tr-sm" 
                  : "bg-transparent text-neutral-300"
              )}>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                </div>
              </div>

              {msg.relationshipGraph && msg.relationshipGraph.length > 0 && (
                <div className="mt-4 text-left">
                  <p className="text-xs font-mono text-emerald-400 mb-2">RELATIONSHIP GRAPH</p>
                  <RelationshipGraph data={msg.relationshipGraph} />
                </div>
              )}

              {msg.followUps && msg.followUps.length > 0 && (
                <div className="mt-4 space-y-2 text-left">
                  <p className="text-xs font-mono text-neutral-500">Suggested follow-ups:</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.followUps.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => onSendMessage(q)}
                        className="text-xs px-3 py-1.5 rounded-full border border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-4 max-w-3xl mx-auto w-full">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="flex-1 flex items-center">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-3xl mx-auto w-full p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-[#0a0a0a] shrink-0">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-[#141414] border border-neutral-800 rounded-xl p-2 focus-within:border-emerald-500/50 transition-colors">
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
              className="w-full max-h-32 min-h-[44px] bg-transparent text-sm p-3 resize-none focus:outline-none placeholder:text-neutral-600 text-neutral-200"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="p-3 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-center text-[10px] text-neutral-600 mt-2 font-mono">
            AI can make mistakes. Consider verifying important information.
          </p>
        </div>
      </div>
    </div>
  );
}
