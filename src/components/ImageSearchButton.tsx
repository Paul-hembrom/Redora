import { Image } from 'lucide-react';

interface ImageSearchButtonProps {
  onClick: () => void;
  isLoading?: boolean;
}

export function ImageSearchButton({ onClick, isLoading }: ImageSearchButtonProps) {
  return (
    <button 
      onClick={onClick}
      disabled={isLoading}
      className="text-xs font-medium px-3 py-1.5 rounded-md text-white/60 hover:text-cyan-400 hover:bg-white/5 transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed" 
      title="Find educational images"
    >
      <Image className="w-3.5 h-3.5" /> 
      {isLoading ? "Finding..." : "Images"}
    </button>
  );
}
