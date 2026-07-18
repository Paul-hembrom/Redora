import React, { useState, useRef, useEffect } from 'react';
import { Search, Image as ImageIcon, Loader2, X } from 'lucide-react';

interface SerperImageSearchProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function SerperImageSearch({ onSearch, isLoading }: SerperImageSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query.trim());
      setQuery('');
      setIsOpen(false);
    }
  };

  if (isOpen) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 shrink-0 animate-in fade-in slide-in-from-right-2">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search high-quality images..."
            className="w-48 text-xs px-2.5 py-1.5 bg-black/40 border border-white/20 rounded-md text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute right-1.5 p-0.5 text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        <button
          type="submit"
          disabled={!query.trim() || isLoading}
          className="text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed border border-cyan-500/30"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        </button>
      </form>
    );
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      disabled={isLoading}
      className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-fuchsia-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0"
      title="Search the web for educational images"
    >
      <ImageIcon className="w-3.5 h-3.5" /> Image Search Pro
    </button>
  );
}
