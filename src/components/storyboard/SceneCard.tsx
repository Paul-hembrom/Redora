import React, { useState } from 'react';
import { RefreshCw, PlayCircle, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

interface Scene {
  id: string;
  scene_number: number;
  narration: string;
  visual_prompt: string;
  image_url?: string;
  narration_url?: string;
  model_used?: string;
}

interface SceneCardProps {
  scene: Scene;
  onRegenerate: (sceneId: string) => void;
  isStudent?: boolean;
}

export default function SceneCard({ scene, onRegenerate, isStudent }: SceneCardProps) {
  const { user } = useAuth();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [editingField, setEditingField] = useState<'narration' | 'visual_prompt' | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    await onRegenerate(scene.id);
    setTimeout(() => setIsRegenerating(false), 2000); 
  };

  const startInlineEdit = (field: 'narration' | 'visual_prompt', value: string) => {
    if (isStudent || isRegenerating) return;
    setEditingField(field);
    setEditValue(value);
  };

  const saveInlineEdit = async () => {
    if (!editingField || !editValue.trim() || editValue === scene[editingField]) {
      setEditingField(null);
      return;
    }
    const fieldToSave = editingField;
    const valueToSave = editValue;
    setEditingField(null);
    scene[fieldToSave] = valueToSave;

    try {
      await fetch(`/api/scenes/${scene.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldToSave]: valueToSave })
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden flex flex-col md:flex-row shadow-lg transition-colors hover:border-white/20">
      {/* Visual Column */}
      <div className="md:w-1/3 bg-black/60 relative group aspect-video md:aspect-auto border-b md:border-b-0 md:border-r border-white/10">
        {scene.image_url ? (
          <img src={scene.image_url} alt="Scene visual" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
            <ImageIcon className="w-10 h-10 mb-2" />
            <span className="text-xs">No Visual</span>
          </div>
        )}
        
        {scene.model_used && (
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-[10px] font-mono text-cyan-400">
            {scene.model_used}
          </div>
        )}
      </div>

      {/* Content Column */}
      <div className="flex-1 p-5 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <h4 className="text-lg font-semibold text-white/90">Scene {scene.scene_number}</h4>
          {!isStudent && (
            <button 
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md text-white/70 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? 'Generating...' : 'Regenerate'}
            </button>
          )}
        </div>

        <div className="space-y-4 flex-1">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-500 font-semibold mb-1 hidden">Narration</p>
            {editingField === 'narration' ? (
              <textarea 
                className="w-full bg-black/40 border border-cyan-500/50 rounded-md p-2 text-sm font-serif text-white outline-none resize-none"
                autoFocus 
                rows={3}
                value={editValue} 
                onChange={(e) => setEditValue(e.target.value)} 
                onBlur={saveInlineEdit}
              />
            ) : (
              <p 
                className={cn("text-sm font-serif leading-relaxed text-white/80 italic border-l-2 border-cyan-500/30 pl-3", !isStudent && "cursor-pointer hover:bg-white/5 rounded-r-md transition-colors")}
                onClick={() => { if (!isStudent) startInlineEdit('narration', scene.narration) }}
                title={!isStudent ? "Click to edit narration" : ""}
              >
                "{scene.narration}"
              </p>
            )}
          </div>
          
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Visual Prompt</p>
            {editingField === 'visual_prompt' ? (
              <textarea 
                className="w-full bg-black/40 border border-cyan-500/50 rounded-md p-2 text-xs text-white outline-none resize-none"
                autoFocus 
                rows={2}
                value={editValue} 
                onChange={(e) => setEditValue(e.target.value)} 
                onBlur={saveInlineEdit}
              />
            ) : (
              <p 
                className={cn("text-xs text-white/60 leading-normal", !isStudent && "cursor-pointer hover:bg-white/5 rounded-md p-1 -m-1 transition-colors")}
                onClick={() => { if (!isStudent) startInlineEdit('visual_prompt', scene.visual_prompt) }}
                title={!isStudent ? "Click to edit prompt" : ""}
              >
                {scene.visual_prompt}
              </p>
            )}
          </div>
        </div>

        {/* Audio Player if present */}
        {scene.narration_url && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
            <PlayCircle className="w-5 h-5 text-emerald-400" />
            <audio controls src={scene.narration_url} className="h-8 flex-1 max-w-[200px] opacity-70 hover:opacity-100" />
            <span className="text-[10px] text-white/40 ml-auto uppercase tracking-wide">Narration Audio</span>
          </div>
        )}
      </div>
    </div>
  );
}
