import React from 'react';
import { Check, ArrowLeft } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BetaBadge } from './BetaBadge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Pricing() {
  const WHATSAPP_LINK = "https://wa.me/917596001221?text=Hi,%20I%20would%20like%20to%20upgrade%20my%20Readora%20plan.";

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-x-hidden selection:bg-cyan-500/30">
      {/* Navbar */}
      <header className="h-16 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 z-30 sticky top-0">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
             <ArrowLeft className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="font-display font-medium text-sm text-white/70">Back to Workspace</span>
        </a>
        <div className="font-display font-bold text-lg tracking-wide">READORA</div>
        <div className="w-20" /> {/* Spacer for centering */}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 md:mb-24">
          <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-6">
            Simple, honest pricing.
          </h1>
          <p className="text-lg md:text-xl text-white/50 leading-relaxed font-light">
            Unlock the full power of your documents. No hidden fees.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-start">
          
          {/* Free Plan */}
          <div className="relative flex flex-col p-8 rounded-3xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors h-full">
            <div className="mb-6">
              <h3 className="text-xl font-display font-semibold mb-2">Free</h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold">$0</span>
              </div>
              <p className="text-sm text-white/50">Perfect for trying out. Forever free.</p>
            </div>
            
            <a 
              href="/"
              className="w-full py-3 px-4 rounded-xl font-medium text-sm text-center bg-white/10 hover:bg-white/20 text-white transition-colors mb-8"
            >
              Get Started Free
            </a>

            <div className="flex flex-col gap-4 flex-1">
              {[
                { text: '4 books/month' },
                { text: '2 AI-generated videos/month', beta: true },
                { text: '20 image searches/month' },
                { text: '10 YouTube searches/day' },
                { text: '10 chat messages/day' }
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-cyan-400 shrink-0" />
                  <span className="text-sm text-white/70 flex items-center gap-2">
                    {feature.text} {feature.beta && <BetaBadge className="text-[10px] px-1.5 py-0" />}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Monthly */}
          <div className="relative flex flex-col p-8 rounded-3xl bg-gradient-to-b md:-mt-8 from-cyan-900/40 to-cyan-900/10 border-2 border-cyan-500/50 shadow-2xl shadow-cyan-900/20 h-full">
            <div className="absolute -top-4 left-0 right-0 flex justify-center">
              <span className="bg-cyan-500 text-black text-xs font-bold uppercase tracking-widest py-1.5 px-4 rounded-full">
                Most Popular
              </span>
            </div>
            
            <div className="mb-6 mt-2">
              <h3 className="text-xl font-display font-semibold text-cyan-400 mb-2">Pro Monthly</h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold text-white">$29.99</span>
                <span className="text-white/50 font-medium">/month</span>
              </div>
              <p className="text-sm text-white/50">Everything you need without limits.</p>
            </div>
            
            <a 
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 px-4 rounded-xl font-medium text-sm text-center bg-cyan-500 hover:bg-cyan-400 text-black transition-colors mb-8 shadow-lg shadow-cyan-500/25"
            >
              Upgrade Now
            </a>

            <div className="flex flex-col gap-4 flex-1">
              {[
                { text: 'Unlimited books' },
                { text: '10 video generations/month', beta: true },
                { text: '50 image searches/month' },
                { text: 'Unlimited chat' },
                { text: 'Priority support' }
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-cyan-400 shrink-0" />
                  <span className="text-sm text-white/90 flex items-center gap-2">
                    {feature.text} {feature.beta && <BetaBadge className="text-[10px] px-1.5 py-0" />}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Lifetime */}
          <div className="relative flex flex-col p-8 rounded-3xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors h-full">
            <div className="mb-6">
              <h3 className="text-xl font-display font-semibold mb-2">Lifetime</h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold">$499.99</span>
                <span className="text-white/50 font-medium">one-time</span>
              </div>
              <p className="text-sm text-white/50">Pay once, enjoy forever.</p>
            </div>
            
            <a 
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 px-4 rounded-xl font-medium text-sm text-center bg-white border border-white/20 text-black hover:bg-white/90 transition-colors mb-8"
            >
              Upgrade Now
            </a>

            <div className="flex flex-col gap-4 flex-1">
              {[
                'All Pro features forever',
                'One-time payment',
                'No recurring bills'
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-cyan-400 shrink-0" />
                  <span className="text-sm text-white/70">{feature}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Note */}
        <div className="mt-20 text-center">
          <p className="text-white/40 text-sm">
            For schools and institutions, please visit our <a href="/" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4">Schools page</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
