import React from 'react';

export const BetaBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-yellow-100 px-2 flex-shrink-0 py-0.5 text-xs font-semibold text-yellow-800 border border-yellow-300 shadow-sm ${className}`}
      title="This feature is in Beta"
    >
      Beta
    </span>
  );
};
