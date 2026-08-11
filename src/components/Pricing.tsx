import React, { useState } from 'react';
import { Check, ArrowLeft, Globe } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Pricing() {
  const WHATSAPP_LINK = "https://wa.me/917596001221?text=Hi,%20I%20would%20like%20to%20upgrade%20my%20Readora%20plan.";
  const [currency, setCurrency] = useState<'USD' | 'NPR'>('USD');

  const plans = [
    {
      name: 'Free',
      usdPrice: '$0',
      nprPrice: 'NPR 0',
      period: 'forever',
      description: 'Perfect for trying out. Forever free.',
      popular: false,
      features: [
        '5 books / month',
        '200 chat messages / month',
        '100 Ask questions / month',
        '30 read-aloud requests / month',
        '2 interactive lessons / month',
        '20 image searches / month'
      ]
    },
    {
      name: 'Basic',
      usdPrice: '$4.99',
      nprPrice: 'NPR 299',
      period: '/month',
      description: 'Great for regular student reading.',
      popular: false,
      features: [
        '30 books / month',
        '2,000 chat messages / month',
        '1,000 Ask questions / month',
        '300 read-aloud requests / month',
        '15 interactive lessons / month',
        '100 image searches / month'
      ]
    },
    {
      name: 'Pro',
      usdPrice: '$9.99',
      nprPrice: 'NPR 699',
      period: '/month',
      description: 'For dedicated learners and power users.',
      popular: true,
      features: [
        '100 books / month',
        'Unlimited chat messages',
        'Unlimited Ask questions',
        'Unlimited read-aloud requests',
        '50 interactive lessons / month',
        '500 image searches / month'
      ]
    },
    {
      name: 'Pro Plus',
      usdPrice: '$19.99',
      nprPrice: 'NPR 1,299',
      period: '/month',
      description: 'Complete unthrottled access to everything.',
      popular: false,
      features: [
        'Unlimited books',
        'Unlimited chat messages',
        'Unlimited Ask questions',
        'Unlimited read-aloud requests',
        'Unlimited interactive lessons',
        'Unlimited image search'
      ]
    }
  ];

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
        <div className="w-20" />
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12 md:py-20">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
            Simple, honest pricing.
          </h1>
          <p className="text-base md:text-lg text-white/60 leading-relaxed font-light mb-8">
            Choose a plan tailored to your learning goals. No hidden fees.
          </p>

          {/* Region Toggle */}
          <div className="inline-flex items-center p-1 bg-white/5 border border-white/10 rounded-xl">
            <button
              onClick={() => setCurrency('USD')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
                currency === 'USD' ? "bg-cyan-500 text-black shadow" : "text-white/60 hover:text-white"
              )}
            >
              <Globe className="w-3.5 h-3.5" /> International ($ USD)
            </button>
            <button
              onClick={() => setCurrency('NPR')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
                currency === 'NPR' ? "bg-cyan-500 text-black shadow" : "text-white/60 hover:text-white"
              )}
            >
              Nepal / South Asia (NPR)
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {plans.map((plan) => {
            const price = currency === 'USD' ? plan.usdPrice : plan.nprPrice;
            return (
              <div
                key={plan.name}
                className={cn(
                  "relative flex flex-col p-6 rounded-2xl transition-all h-full",
                  plan.popular
                    ? "bg-gradient-to-b from-cyan-950/60 to-cyan-900/20 border-2 border-cyan-500/60 shadow-xl shadow-cyan-950/50"
                    : "bg-white/[0.02] border border-white/10 hover:border-white/20"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                    <span className="bg-cyan-500 text-black text-[10px] font-bold uppercase tracking-widest py-1 px-3 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6 mt-1">
                  <h3 className={cn("text-lg font-display font-semibold mb-2", plan.popular ? "text-cyan-400" : "text-white")}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-bold text-white">{price}</span>
                    <span className="text-xs text-white/50 font-medium">{plan.period}</span>
                  </div>
                  <p className="text-xs text-white/50">{plan.description}</p>
                </div>

                <a
                  href={plan.name === 'Free' ? '/' : WHATSAPP_LINK}
                  target={plan.name === 'Free' ? '_self' : '_blank'}
                  rel="noreferrer"
                  className={cn(
                    "w-full py-2.5 px-4 rounded-xl font-medium text-xs text-center transition-all mb-6",
                    plan.popular
                      ? "bg-cyan-500 hover:bg-cyan-400 text-black font-semibold shadow-lg shadow-cyan-500/20"
                      : "bg-white/10 hover:bg-white/20 text-white"
                  )}
                >
                  {plan.name === 'Free' ? 'Get Started' : 'Upgrade Plan'}
                </a>

                <div className="flex flex-col gap-3 flex-1 border-t border-white/5 pt-4">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-white/75">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 md:p-8 overflow-x-auto">
          <h2 className="text-xl font-display font-bold text-white mb-6">Full Plan Comparison</h2>
          <table className="w-full text-left text-xs min-w-[600px]">
            <thead>
              <tr className="border-b border-white/10 text-white/60">
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Feature</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">Free</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">Basic</th>
                <th className="py-3 px-4 font-semibold text-cyan-400 uppercase tracking-wider text-center">Pro</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">Pro Plus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/80">
              <tr>
                <td className="py-3 px-4 font-medium text-white/90">International Price</td>
                <td className="py-3 px-4 text-center">$0</td>
                <td className="py-3 px-4 text-center">$4.99/mo</td>
                <td className="py-3 px-4 text-center font-medium text-cyan-400">$9.99/mo</td>
                <td className="py-3 px-4 text-center">$19.99/mo</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-white/90">Nepal / South Asia Price</td>
                <td className="py-3 px-4 text-center">NPR 0</td>
                <td className="py-3 px-4 text-center">NPR 299</td>
                <td className="py-3 px-4 text-center font-medium text-cyan-400">NPR 699</td>
                <td className="py-3 px-4 text-center">NPR 1,299</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-white/90">Books</td>
                <td className="py-3 px-4 text-center">5 / mo</td>
                <td className="py-3 px-4 text-center">30 / mo</td>
                <td className="py-3 px-4 text-center">100 / mo</td>
                <td className="py-3 px-4 text-center font-semibold text-cyan-400">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-white/90">Chat messages</td>
                <td className="py-3 px-4 text-center">200 / mo</td>
                <td className="py-3 px-4 text-center">2,000 / mo</td>
                <td className="py-3 px-4 text-center font-semibold text-cyan-400">Unlimited</td>
                <td className="py-3 px-4 text-center font-semibold text-cyan-400">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-white/90">Ask questions</td>
                <td className="py-3 px-4 text-center">100 / mo</td>
                <td className="py-3 px-4 text-center">1,000 / mo</td>
                <td className="py-3 px-4 text-center font-semibold text-cyan-400">Unlimited</td>
                <td className="py-3 px-4 text-center font-semibold text-cyan-400">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-white/90">Read-aloud</td>
                <td className="py-3 px-4 text-center">30 / mo</td>
                <td className="py-3 px-4 text-center">300 / mo</td>
                <td className="py-3 px-4 text-center font-semibold text-cyan-400">Unlimited</td>
                <td className="py-3 px-4 text-center font-semibold text-cyan-400">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-white/90">Interactive lessons</td>
                <td className="py-3 px-4 text-center">2 / mo</td>
                <td className="py-3 px-4 text-center">15 / mo</td>
                <td className="py-3 px-4 text-center">50 / mo</td>
                <td className="py-3 px-4 text-center font-semibold text-cyan-400">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-white/90">Image search</td>
                <td className="py-3 px-4 text-center">20 / mo</td>
                <td className="py-3 px-4 text-center">100 / mo</td>
                <td className="py-3 px-4 text-center">500 / mo</td>
                <td className="py-3 px-4 text-center font-semibold text-cyan-400">Unlimited</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="mt-16 text-center">
          <p className="text-white/40 text-xs">
            For schools and institutional accounts, please visit our <a href="/" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4">Schools page</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
