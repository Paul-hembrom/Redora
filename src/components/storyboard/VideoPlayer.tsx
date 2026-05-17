import React from 'react';
import { Play } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
}

export default function VideoPlayer({ url }: VideoPlayerProps) {
  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-white/10 relative shadow-2xl flex items-center justify-center">
      {url ? (
        <video 
          src={url} 
          controls 
          autoPlay
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center text-white/50">
          <Play className="w-12 h-12 mb-2 opacity-20" />
          <p>Video unavailable</p>
        </div>
      )}
    </div>
  );
}
