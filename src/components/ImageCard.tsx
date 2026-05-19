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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setIsOpen(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center">
            <button 
              className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={image.url} 
              alt={image.alt} 
              className="w-full h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
