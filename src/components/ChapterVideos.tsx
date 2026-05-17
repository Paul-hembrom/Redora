import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Video } from 'lucide-react';

interface RecommendedVideo {
  title: string;
  channel: string;
  reason: string;
  search_query_used: string;
  video_id: string;
  embed_type: string;
  quality_score: number;
}

interface ChapterVideosProps {
  title: string;
  summary: string;
}

export default function ChapterVideos({ title, summary }: ChapterVideosProps) {
  const [videos, setVideos] = useState<RecommendedVideo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasFetched, setHasFetched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasFetched && title) {
          setHasFetched(true);
          fetchVideos();
        }
      },
      { rootMargin: '200px' } 
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    const fetchVideos = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/retrieve-videos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title,
            summary,
            subject: 'General Education',
            grade: 'High School',
            keyConcepts: []
          })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch videos');
        }

        const data = await response.json();
        if (isMounted) {
          setVideos(data.recommended_videos || []);
        }
      } catch (err: any) {
        if (isMounted) {
          setError('Could not find recommended videos. Please try again later.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    return () => {
      isMounted = false;
      observer.disconnect();
    };
  }, [title, summary, hasFetched]);

  if (!videos && !loading && !error && hasFetched) {
    return null;
  }

  return (
    <div ref={containerRef} className="mt-8 border-t border-white/10 pt-8">
      <h3 className="text-xl font-medium text-white flex items-center gap-2 mb-6">
        <Video className="w-5 h-5 text-cyan-400" />
        Recommended Videos
      </h3>

      {loading && !videos ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-white/5 bg-white/5">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
          <p className="text-white/70">Finding the best educational videos...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8 border border-white/10 rounded-lg bg-red-500/10 text-red-400 flex flex-col items-center">
          <p className="mb-4">{error}</p>
          <button 
            onClick={() => { setHasFetched(false); setError(''); }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded transition"
          >
            Retry
          </button>
        </div>
      ) : videos && videos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {videos.map((video, idx) => (
            <div key={idx} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden flex flex-col">
              <div className="aspect-video bg-black relative">
                <iframe 
                  src={`https://www.youtube.com/embed/${video.video_id}`} 
                  title={video.title} 
                  className="w-full h-full absolute inset-0 border-0"
                  allowFullScreen
                />
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-medium text-white line-clamp-2" title={video.title}>{video.title}</h4>
                  <span className="shrink-0 bg-cyan-500/20 text-cyan-400 text-xs px-2 py-1 rounded font-medium">
                    Score: {video.quality_score}
                  </span>
                </div>
                <p className="text-xs text-white/50 mb-3">{video.channel}</p>
                <p className="text-sm text-white/70 italic mb-2 flex-1">{video.reason}</p>
              </div>
            </div>
          ))}
        </div>
      ) : hasFetched ? (
        <div className="text-center py-8 border border-white/10 rounded-lg bg-white/5 text-white/50">
          No relevant videos found for this chapter.
        </div>
      ) : (
        <div className="flex justify-center items-center py-8 text-white/30 text-sm">
          Scroll down to discover videos...
        </div>
      )}
    </div>
  );
}
