import React from 'react';
import { Loader2, CheckCircle2, Clock, Film } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SceneQueueItem {
  id: string;
  scene_number: number;
  visual_prompt: string;
  image_url?: string;
}

interface GenerationQueueProps {
  scenes: SceneQueueItem[];
  jobStatus: string;
}

export default function GenerationQueue({ scenes, jobStatus }: GenerationQueueProps) {
  let foundGenerating = false;
  const isJobActive = jobStatus === 'pending' || jobStatus === 'processing' || jobStatus === 'generating';

  return (
    <div className="w-full max-w-4xl mx-auto my-8 p-6 border border-white/10 rounded-xl bg-black/40 backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Film className="w-5 h-5 text-cyan-400" />
        Render Queue
      </h3>
      <div className="space-y-3">
        {scenes.map((scene, index) => {
          let state: 'complete' | 'generating' | 'pending' = 'pending';
          
          if (scene.image_url) {
            state = 'complete';
          } else if (isJobActive && !foundGenerating) {
            state = 'generating';
            foundGenerating = true;
          }

          return (
            <div 
              key={scene.id}
              className={cn(
                "flex items-center gap-4 p-3 rounded-lg border transition-colors",
                state === 'complete' ? "bg-white/5 border-white/10" :
                state === 'generating' ? "bg-cyan-500/10 border-cyan-500/30" :
                "bg-black/20 border-white/5 opacity-60"
              )}
            >
              <div className="w-8 flex justify-center">
                {state === 'complete' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {state === 'generating' && <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />}
                {state === 'pending' && <Clock className="w-5 h-5 text-white/30" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Scene {scene.scene_number}</span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-semibold",
                    state === 'complete' ? "bg-emerald-500/20 text-emerald-400" :
                    state === 'generating' ? "bg-cyan-500/20 text-cyan-400" :
                    "bg-white/10 text-white/40"
                  )}>
                    {state}
                  </span>
                </div>
                <p className="text-sm text-white/80 truncate" title={scene.visual_prompt}>
                  {scene.visual_prompt}
                </p>
              </div>

              {state === 'complete' && scene.image_url && (
                <div className="w-16 h-10 rounded overflow-hidden bg-black/50 border border-white/10 flex-shrink-0">
                  <img src={scene.image_url} alt={`Scene ${scene.scene_number}`} className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
