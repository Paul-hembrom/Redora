import React, { useEffect, useState } from 'react';
import { X, Target, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuizHistoryItem {
  date: string;
  chapterTitle: string;
  score: number;
  total: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuizDashboardModal({ isOpen, onClose }: Props) {
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('quizHistory');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Sort by newest first
          parsed.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setHistory(parsed);
        } catch (e) {
          console.error("Failed to parse quiz history", e);
        }
      }
    }
  }, [isOpen]);

  // Also listen for updates
  useEffect(() => {
    const handleUpdate = () => {
      const stored = localStorage.getItem('quizHistory');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setHistory(parsed);
        } catch (e) {}
      }
    };
    window.addEventListener('quiz-history-updated', handleUpdate);
    return () => window.removeEventListener('quiz-history-updated', handleUpdate);
  }, []);

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear your quiz history?")) {
      localStorage.removeItem('quizHistory');
      setHistory([]);
    }
  };

  if (!isOpen) return null;

  const totalQuizzes = history.length;
  const averageScore = totalQuizzes > 0 
    ? Math.round(history.reduce((acc, curr) => acc + (curr.score / curr.total) * 100, 0) / totalQuizzes)
    : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
            <div className="flex items-center gap-3 text-cyan-400">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white">Quiz Performance</h2>
                <p className="text-xs text-cyan-400/70 font-medium tracking-wide uppercase">Your learning dashboard</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/40 py-12">
                <Target className="w-12 h-12 mb-4 opacity-20" />
                <p>No quiz history yet. Take some quizzes to track your performance!</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Stats row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col">
                    <span className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1">Total Quizzes</span>
                    <span className="text-3xl font-bold text-white">{totalQuizzes}</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col">
                    <span className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1">Average Score</span>
                    <span className="text-3xl font-bold text-cyan-400">{averageScore}%</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="text-sm font-semibold text-white/80 uppercase tracking-widest">Recent Activity</h3>
                    <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Clear History
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {history.map((item, i) => {
                      const percentage = Math.round((item.score / item.total) * 100);
                      const isGood = percentage >= 80;
                      const isOk = percentage >= 60 && percentage < 80;
                      
                      return (
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex-1 pr-4">
                            <h4 className="text-white font-medium truncate mb-1">{item.chapterTitle}</h4>
                            <p className="text-xs text-white/40">
                              {new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className={cn(
                                "text-lg font-bold",
                                isGood ? "text-emerald-400" : isOk ? "text-amber-400" : "text-red-400"
                              )}>
                                {item.score} <span className="text-sm text-white/30">/ {item.total}</span>
                              </span>
                              <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider">Score</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
