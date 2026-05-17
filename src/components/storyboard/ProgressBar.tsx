import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

interface ProgressBarProps {
  progress: number;
  status: string;
}

export default function ProgressBar({ progress, status }: ProgressBarProps) {
  return (
    <div className="w-full max-w-2xl mx-auto my-12 p-8 border border-white/10 rounded-xl bg-white/5 backdrop-blur-sm text-center">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
      <h3 className="text-xl font-medium text-white mb-2 tracking-tight">Generating Video Lesson...</h3>
      <p className="text-white/60 mb-6 capitalize">{status.replace('_', ' ')}</p>
      
      <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
        <motion.div 
          className="h-full bg-cyan-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <div className="mt-2 text-right text-xs text-white/40 font-mono">
        {progress}%
      </div>
    </div>
  );
}
