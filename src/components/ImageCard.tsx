import { useState } from 'react';
import { cn } from '../lib/utils';
import { X } from 'lucide-react';

interface ImageCardProps {
  image: {
    url: string;
    thumbnail: string;
    alt: string;
    source: 'real' | 'generated';
  };
}

export function ImageCard({ image }: ImageCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div 
        className="relative group rounded-md overflow-hidden bg-black/20 border border-white/10 cursor-pointer aspect-video"
        onClick={() => setIsOpen(true)}
      >
        <img 
          src={image.thumbnail} 
          alt={image.alt} 
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
        {image.source === 'generated' && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] uppercase font-bold text-cyan-400 border border-white/10">
            AI Generated
          </div>
        )}
      </div>

      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setIsOpen(false)}
        >
          <button 
            className="absolute top-6 right-6 p-3 text-white/70 hover:text-white transition-colors z-[60] bg-black/40 hover:bg-black/60 rounded-full border border-white/10"
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img 
              src={image.url} 
              alt={image.alt} 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
