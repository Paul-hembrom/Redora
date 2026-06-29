import React, { useState } from 'react';
import { generateExerciseAnswer } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

interface ExerciseCardProps {
  question: string;
  chapterContent: string;
  onAskAI: (question: string) => void;
}

export function ExerciseCard({ question, chapterContent, onAskAI }: ExerciseCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReveal = async () => {
    if (isRevealed) {
      setIsRevealed(false);
      return;
    }
    
    if (answer) {
      setIsRevealed(true);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const res = await generateExerciseAnswer(question, chapterContent);
      setAnswer(res);
      setIsRevealed(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate answer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="group relative bg-white/[0.02] border border-white/5 rounded-xl p-6 transition-all hover:bg-white/[0.04]">
      <div className="prose prose-invert prose-sm max-w-none text-white/90 leading-relaxed font-serif whitespace-pre-wrap break-words pr-12">
        {(() => {
          const lines = question.split('\n');
          const firstLine = lines[0];
          const isHeading = /^(?:State whether|Match the|Fill in the|Write full|Write technical|Answer the|Select the|Project Work|Q\d+)/i.test(firstLine.trim()) && !/^\d+\./.test(firstLine.trim());
          
          if (isHeading) {
            return (
              <>
                <div className="font-sans font-bold text-lg text-white mb-2">{firstLine}</div>
                {lines.slice(1).join('\n')}
              </>
            );
          }
          return question;
        })()}
      </div>
      
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={handleReveal}
          disabled={isLoading}
          className="px-3 py-1.5 bg-black/40 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium rounded-lg backdrop-blur shadow-lg border border-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
          title="Toggle Flashcard Answer"
        >
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          ) : (
            <span className="text-sm">🔄</span>
          )}
          <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
        </button>
        <button
          onClick={() => onAskAI(question)}
          className="p-2 bg-black/40 hover:bg-cyan-500/20 text-white/60 hover:text-cyan-400 rounded-lg backdrop-blur shadow-lg border border-white/10 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2"
          title="Ask AI Teacher to solve this"
        >
          <span className="text-sm">⭐</span>
          <span className="text-xs font-medium">Ask AI</span>
        </button>
      </div>

      <AnimatePresence>
        {isRevealed && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs font-display font-semibold text-white/50 tracking-widest uppercase mb-3">AI Solution</p>
              {error ? (
                <div className="text-red-400 text-sm bg-red-400/10 p-4 rounded-lg border border-red-400/20">
                  {error}
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none text-white/80 leading-relaxed font-sans">
                  {answer ? (
                    <Markdown>{answer}</Markdown>
                  ) : (
                    <div className="flex flex-col gap-2">
                       <div className="h-4 bg-white/5 rounded w-3/4 animate-pulse"></div>
                       <div className="h-4 bg-white/5 rounded w-full animate-pulse"></div>
                       <div className="h-4 bg-white/5 rounded w-5/6 animate-pulse"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
