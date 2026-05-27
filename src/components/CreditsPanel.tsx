import React, { useEffect, useState } from 'react';
import { Film, Image, GraduationCap, BookOpen, Clock, AlertTriangle } from 'lucide-react';

interface CreditsPanelProps {
  className?: string;
  onUpdate?: (usage: any) => void;
}

export function CreditsPanel({ className = '', onUpdate }: CreditsPanelProps) {
  const [userUsage, setUserUsage] = useState<any>(null);

  const fetchUsage = () => {
    fetch('/api/me/context')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setUserUsage(data);
          if (onUpdate) onUpdate(data);
        }
      })
      .catch(err => console.error("Could not fetch context", err));
  };

  useEffect(() => {
    fetchUsage();
    window.addEventListener('usage-updated', fetchUsage);
    return () => window.removeEventListener('usage-updated', fetchUsage);
  }, []);

  if (!userUsage || userUsage.context !== 'school') return null;

  const { plan, is_trial, trial_days_left, status, usage, role } = userUsage;
  const isStudent = role === 'student';

  const renderBadge = (icon: React.ReactNode, label: string, data: any) => {
    if (!data) return null;
    
    // Student read-only mode => "Videos available: 13"
    if (isStudent && status !== 'locked') {
       if (data.limit === null) return null; 
       const remain = Math.max(0, data.limit - data.used);
       return (
         <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] sm:text-xs">
           <span className="text-white/60 shrink-0">{icon}</span>
           <span className="text-white/70 whitespace-nowrap">{label} available: <span className="font-bold text-white">{remain}</span></span>
         </div>
       );
    }
    
    // Teacher/Admin full mode
    const limitText = data.limit === null ? '∞' : data.limit;
    const isError = data.limit !== null && data.used >= data.limit;
    const isWarn = data.limit !== null && data.used >= data.limit * 0.8 && !isError;
    
    const progressPercent = data.limit === null || data.limit === 0 ? 100 : Math.min(100, (data.used / data.limit) * 100);
    
    let colorClass = "bg-green-500/80";
    if (isWarn) colorClass = "bg-yellow-500/80";
    if (isError) colorClass = "bg-red-500/80";
    if (data.limit === 0 || status === 'locked') colorClass = "bg-red-500/80";

    return (
      <div className="relative group flex flex-col items-start gap-1 p-1.5 sm:px-2 sm:py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-default min-w-[70px] sm:min-w-[85px]">
        <div className="flex items-center gap-1.5 flex-wrap w-full text-[10px] sm:text-xs">
          <span className="text-white/60 shrink-0">{icon}</span>
          <span className="text-white font-medium whitespace-nowrap">{data.used} <span className="text-white/30 text-[9px] font-normal">/ {limitText}</span></span>
        </div>
        {/* Subtle Progress Bar */}
        {data.limit !== null && data.limit > 0 && (
          <div className="w-full h-0.5 bg-black/40 rounded-full overflow-hidden mt-0.5">
             <div className={`h-full ${colorClass}`} style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex items-center gap-2 sm:gap-4 ${className}`}>
      {/* Banners */}
      {!isStudent && is_trial && status !== 'locked' && (
        <div className="hidden lg:flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500/90 text-[10px] sm:text-xs px-2.5 py-1 rounded-md">
           <Clock className="w-3.5 h-3.5 shrink-0" />
           <span><span className="font-semibold">{plan} Trial</span> &ndash; {trial_days_left} days left. <a onClick={() => window.dispatchEvent(new Event('open-pricing'))} className="underline cursor-pointer hover:text-yellow-400">Upgrade to unlock videos & images.</a></span>
        </div>
      )}
      
      {(status === 'past_due' || status === 'unpaid' || status === 'locked') && !isStudent && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-500/90 text-[10px] sm:text-xs px-2.5 py-1 rounded-md">
           <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
           <span><span className="font-semibold">Account {status === 'locked' ? 'Suspended' : 'Past Due'}</span>. <a href="https://wa.me/917596001221" target="_blank" rel="noreferrer" className="underline hover:text-red-400">Contact Support on WhatsApp</a></span>
        </div>
      )}

      {/* Badges */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
         {renderBadge(<Film className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, "Videos", usage.videos)}
         {renderBadge(<Image className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, "Images", usage.images)}
         {renderBadge(<GraduationCap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, "Lessons", usage.interactive_lessons)}
         {renderBadge(<BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, "Books", usage.books)}
      </div>

    </div>
  );
}
