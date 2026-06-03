import React, { useState } from 'react';
import { X, Check, Loader2, Sparkles } from 'lucide-react';
import { BetaBadge } from './BetaBadge';

interface Props {
  currentPlan: string;
  onClose: () => void;
  onUpgradeComplete: () => void;
}

export default function PricingModal({ currentPlan, onClose, onUpgradeComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPro = currentPlan.toLowerCase() === 'unlimited' || currentPlan.toLowerCase() === 'pro';

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'unlimited' })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upgrade');
      }
      onUpgradeComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-10 w-full max-w-4xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center max-w-2xl mx-auto mb-12 relative z-10">
          <h2 className="text-3xl font-display font-bold text-white mb-4">Upgrade your learning potential</h2>
          <p className="text-white/60">Unlock unlimited document uploads, high-resolution video generations, and unthrottled access to immersive interactive lessons.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 relative z-10">
          {/* Free Plan */}
          <div className={`p-8 rounded-2xl border ${!isPro ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/10 bg-white/5'} transition-all`}>
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">Free Plan</h3>
              <p className="text-white/60 text-sm">Perfect for casual learners and exploration.</p>
            </div>
            <div className="text-4xl font-bold text-white mb-8">
              $0<span className="text-lg text-white/40 font-normal"> /mo</span>
            </div>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3 text-white/70 text-sm">
                <Check className="w-5 h-5 text-cyan-500 shrink-0" />
                <span>4 Document uploads / month</span>
              </li>
              <li className="flex items-center gap-3 text-white/70 text-sm">
                <Check className="w-5 h-5 text-cyan-500 shrink-0" />
                <span className="flex items-center gap-2">2 Video generations / month <BetaBadge className="text-[10px] px-1.5 py-0" /></span>
              </li>
              <li className="flex items-center gap-3 text-white/70 text-sm">
                <Check className="w-5 h-5 text-cyan-500 shrink-0" />
                <span>20 Image generations / month</span>
              </li>
              <li className="flex items-center gap-3 text-white/70 text-sm">
                <Check className="w-5 h-5 text-cyan-500 shrink-0" />
                <span className="flex items-center gap-2">10 Interactive lessons / month <BetaBadge className="text-[10px] px-1.5 py-0" /></span>
              </li>
            </ul>

            <button 
              disabled={!isPro}
              onClick={onClose}
              className={`w-full py-3 rounded-lg font-medium transition-all ${
                !isPro ? 'bg-white/10 text-white/40 cursor-default' : 'bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              {!isPro ? 'Current Plan' : 'Downgrade'}
            </button>
          </div>

          {/* Pro Plan */}
          <div className={`p-8 rounded-2xl border ${isPro ? 'border-purple-500 bg-purple-500/10' : 'border-purple-500/30 bg-purple-500/5'} relative transition-all`}>
            <div className="absolute top-0 right-8 -translate-y-1/2">
              <span className="bg-gradient-to-r from-cyan-400 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xl">
                <Sparkles className="w-3 h-3" />
                Unlimited
              </span>
            </div>
            
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">Pro Plan</h3>
              <p className="text-white/60 text-sm">Unlimited access for dedicated learners.</p>
            </div>
            <div className="text-4xl font-bold text-white mb-8">
              $19<span className="text-lg text-white/40 font-normal"> /mo</span>
            </div>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3 text-white/90 text-sm">
                <Check className="w-5 h-5 text-purple-400 shrink-0" />
                <span><strong className="text-white">Unlimited</strong> document uploads</span>
              </li>
              <li className="flex items-center gap-3 text-white/90 text-sm">
                <Check className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="flex items-center gap-2"><strong className="text-white">Unlimited</strong> video generations <BetaBadge className="text-[10px] px-1.5 py-0" /></span>
              </li>
              <li className="flex items-center gap-3 text-white/90 text-sm">
                <Check className="w-5 h-5 text-purple-400 shrink-0" />
                <span><strong className="text-white">Unlimited</strong> image generations</span>
              </li>
              <li className="flex items-center gap-3 text-white/90 text-sm">
                <Check className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="flex items-center gap-2"><strong className="text-white">Unlimited</strong> interactive lessons <BetaBadge className="text-[10px] px-1.5 py-0" /></span>
              </li>
              <li className="flex items-center gap-3 text-white/90 text-sm">
                <Check className="w-5 h-5 text-purple-400 shrink-0" />
                <span>Priority processing queue</span>
              </li>
            </ul>

            <button 
              disabled={isPro || loading}
              onClick={handleUpgrade}
              className={`w-full py-3 rounded-lg font-medium shadow-lg transition-all flex items-center justify-center gap-2 ${
                isPro 
                  ? 'bg-purple-500 text-white cursor-default' 
                  : 'bg-white text-black hover:bg-white/90 hover:scale-[1.02] active:scale-95'
              }`}
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {isPro ? 'You are on Pro' : (loading ? 'Upgrading...' : 'Upgrade Now')}
            </button>
            {!isPro && (
               <p className="text-center text-[10px] text-white/30 mt-3">This is a mock upgrade. No real payment required.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
