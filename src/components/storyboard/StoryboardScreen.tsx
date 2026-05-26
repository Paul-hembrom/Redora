import React, { useEffect, useState } from 'react';
import { Film, PlayCircle, Plus, Download } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import ProgressBar from './ProgressBar';
import SceneCard from './SceneCard';
import { useAuth } from '../../contexts/AuthContext';
import JSZip from 'jszip';

interface StoryboardScreenProps {
  chapterId: string;
}

export default function StoryboardScreen({ chapterId }: StoryboardScreenProps) {
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [storyboard, setStoryboard] = useState<any>(null);
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchState = async () => {
    try {
      const res = await fetch(`/api/chapters/${chapterId}/generation-job`);
      if (res.ok) {
        const data = await res.json();
        if (data.job) setJob(data.job);
        if (data.storyboard) setStoryboard(data.storyboard);
        if (data.scenes && data.scenes.length > 0) setScenes(data.scenes);
      }
    } catch (err) {
      console.error('Failed to fetch job', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    
    // Poll if job is processing
    const interval = setInterval(() => {
      if (job && job.status !== 'completed' && job.status !== 'failed') {
        fetchState();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [chapterId, job?.status]);

  const handleStartGeneration = async () => {
    try {
      await fetch(`/api/chapters/${chapterId}/generate-lesson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: 'default' })
      });
      fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegenerateScene = async (sceneId: string) => {
    try {
      await fetch(`/api/scenes/${sceneId}/regenerate`, { method: 'POST' });
      // polling will catch up
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !job) {
    return <div className="p-8 text-center text-white/50">Loading pipeline state...</div>;
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-white/10 rounded-xl my-8">
        <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mb-4">
          <Film className="w-8 h-8 text-cyan-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Generate Video Lesson</h3>
        <p className="text-white/60 mb-8 max-w-md">Transform this chapter into a fully narrated video lesson with cinematic visuals and diagram animations.</p>
        
        {user?.role === 'student' ? (
          <div className="px-6 py-3 bg-white/5 text-white/50 rounded-lg text-sm border border-white/10">
            Waiting for teacher to generate lesson...
          </div>
        ) : (
          <button 
            onClick={handleStartGeneration}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-cyan-900/50 flex items-center gap-2"
          >
            <PlayCircle className="w-5 h-5" /> Start Generation PIPELINE
          </button>
        )}
      </div>
    );
  }

  const isProcessing = job.status === 'pending' || job.status === 'processing' || job.status === 'generating';

  const [isDownloading, setIsDownloading] = useState(false);
  const handleDownloadAssets = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      let index = 1;

      for (const scene of scenes) {
        if (scene.image_url && !scene.image_url.startsWith('file://')) {
          try {
            const res = await fetch(scene.image_url);
            const blob = await res.blob();
            zip.file(`scene_${index}_visual.jpg`, blob);
          } catch (e) {
            console.error('Failed to grab image', e);
          }
        }
        if (scene.narration_url && !scene.narration_url.startsWith('file://')) {
          try {
            const res = await fetch(scene.narration_url);
            const blob = await res.blob();
            zip.file(`scene_${index}_audio.mp3`, blob);
          } catch (e) {
            console.error('Failed to grab audio', e);
          }
        }
        index++;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `storyboard_assets_${chapterId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      <div className="mb-8 border-b border-white/10 pb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Video Lesson</h2>
          <div className="flex items-center gap-3 text-sm text-white/50">
            <span className="px-2 py-1 bg-white/5 rounded">Status: {job.status}</span>
          </div>
        </div>
        {!isProcessing && scenes.length > 0 && (
          <button 
            onClick={handleDownloadAssets}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors border border-white/10"
          >
            <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
            {isDownloading ? 'Packaging...' : 'Download Assets'}
          </button>
        )}
      </div>

      {isProcessing && (
        <ProgressBar progress={job.progress || 0} status={job.status} />
      )}

      {job.status === 'failed' && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg mb-8">
          Pipeline Failed: {job.error_message}
        </div>
      )}

      {job.status === 'completed' && job.video_url && (
        <div className="mb-12">
          <VideoPlayer url={job.video_url} />
        </div>
      )}

      {scenes.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-white mb-6 tracking-tight border-b border-white/10 pb-2 inline-block">Scene Breakdown</h3>
          <div className="space-y-6">
            {scenes.map(scene => (
              <SceneCard 
                key={scene.id} 
                scene={scene} 
                onRegenerate={handleRegenerateScene} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
