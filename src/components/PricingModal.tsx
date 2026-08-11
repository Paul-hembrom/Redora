import React from 'react';
import { X, Check } from 'lucide-react';

interface Props {
  currentPlan: string;
  onClose: () => void;
  onUpgradeComplete: () => void;
}

export default function PricingModal({ currentPlan, onClose }: Props) {
  const WHATSAPP_LINK = "https://wa.me/917596001221?text=Hi,%20I%20would%20like%20to%20upgrade%20my%20Readora%20plan.";

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        '5 books / mo',
        '200 chat messages / mo',
        '100 Ask questions / mo',
        '30 read-aloud requests / mo',
        '2 interactive lessons / mo',
        '20 image searches / mo'
      ]
    },
    {
      name: 'Basic',
      price: '$4.99',
      period: '/month',
      features: [
        '30 books / mo',
        '2,000 chat messages / mo',
        '1,000 Ask questions / mo',
        '300 read-aloud requests / mo',
        '15 interactive lessons / mo',
        '100 image searches / mo'
      ]
    },
    {
      name: 'Pro',
      price: '$9.99',
      period: '/month',
      popular: true,
      features: [
        '100 books / mo',
        'Unlimited chat messages',
        'Unlimited Ask questions',
        'Unlimited read-aloud',
        '50 interactive lessons / mo',
        '500 image searches / mo'
      ]
    },
    {
      name: 'Pro Plus',
      price: '$19.99',
      period: '/month',
      features: [
        'Unlimited books',
        'Unlimited chat messages',
        'Unlimited Ask questions',
        'Unlimited read-aloud',
        'Unlimited interactive lessons',
        'Unlimited image search'
      ]
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 w-full max-w-5xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors z-20"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center max-w-2xl mx-auto mb-8 relative z-10">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">Upgrade Your Learning Plan</h2>
          <p className="text-white/60 text-sm">Choose the plan that best matches your learning goals.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`p-5 rounded-xl border flex flex-col justify-between ${
                plan.popular 
                  ? 'border-cyan-500/60 bg-cyan-950/20' 
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                  {plan.popular && (
                    <span className="text-[10px] bg-cyan-500 text-black font-bold uppercase px-2 py-0.5 rounded-full">
                      Popular
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-white mb-4">
                  {plan.price}<span className="text-xs text-white/40 font-normal"> {plan.period}</span>
                </div>
                
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-white/70 text-xs">
                      <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={plan.name === 'Free' ? '#' : WHATSAPP_LINK}
                target={plan.name === 'Free' ? '_self' : '_blank'}
                rel="noreferrer"
                onClick={plan.name === 'Free' ? onClose : undefined}
                className={`w-full py-2 rounded-lg font-medium text-xs text-center transition-all ${
                  plan.popular 
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 font-semibold' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {plan.name === 'Free' ? 'Close' : 'Upgrade'}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
