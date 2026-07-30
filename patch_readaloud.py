import re

with open('src/components/ReadAloudButton.tsx', 'r') as f:
    content = f.read()

# Imports
content = content.replace("import { Volume2, Square, Loader2, AudioLines, Info } from 'lucide-react';", "import { Volume2, Square, Loader2, AudioLines, Info, Pause, Play } from 'lucide-react';")

# State
state_decl = """  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);"""
content = re.sub(r'  const \[isPlaying, setIsPlaying\] = useState\(false\);\n  const \[isLoading, setIsLoading\] = useState\(false\);', state_decl, content)

# Refs
refs_decl = """  const wrapperRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const pausedStateRef = useRef<{ chunkIndex: number, wordIndex: number, currentTime: number } | null>(null);
  const resumeStateRef = useRef<{ chunkIndex: number, wordIndex: number } | null>(null);
  const currentChunkRef = useRef<any>(null);
  const playNextChunkRef = useRef<((chunkOverride?: any, wordIndexOverride?: number) => void) | null>(null);
  const audioQueueRef = useRef<any[]>([]);"""
content = re.sub(r'  const buttonRef = useRef<HTMLButtonElement>\(null\);\n  const audioQueueRef = useRef<any\[\]>\(\[\]\);', refs_decl, content)

# Fix buttonRef usages
content = content.replace('buttonRef.current', 'wrapperRef.current')
content = content.replace('const btn = wrapperRef.current;', 'const btn = actionButtonRef.current;')

# In stopPlaying
stop_playing_addition = """    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
    pausedStateRef.current = null;
    resumeStateRef.current = null;
    currentChunkRef.current = null;"""
content = re.sub(r'    setIsPlaying\(false\);\n    setIsLoading\(false\);', stop_playing_addition, content)

# Handlers
handlers = """  const handlePause = () => {
    if (!audioRef.current || !currentChunkRef.current) return;
    const currentTime = audioRef.current.currentTime;
    audioRef.current.pause();
    
    let lastSpokenWordIndex = -1;
    const timestamps = currentChunkRef.current.timestamps;
    
    if (timestamps && timestamps.length > 0) {
       for (let k = 0; k < timestamps.length; k++) {
          const start_time = timestamps[k].start_time !== undefined ? timestamps[k].start_time : timestamps[k].start;
          if (currentTime >= start_time) {
             lastSpokenWordIndex = k;
          } else {
             break;
          }
       }
    }
    
    let chunkIndex = currentChunkRef.current.index;
    if (timestamps && lastSpokenWordIndex === timestamps.length - 1) {
       chunkIndex++;
       lastSpokenWordIndex = -1;
    }

    pausedStateRef.current = { chunkIndex, wordIndex: lastSpokenWordIndex, currentTime };
    setIsPaused(true);
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  };

  const handleResume = () => {
    setIsPaused(false);
    if (pausedStateRef.current) {
       const { chunkIndex, wordIndex } = pausedStateRef.current;
       const targetWordIndex = wordIndex + 1;
       
       let targetChunk = null;
       if (currentChunkRef.current && currentChunkRef.current.index === chunkIndex) {
          targetChunk = currentChunkRef.current;
       } else {
          while (audioQueueRef.current.length > 0 && audioQueueRef.current[0].index < chunkIndex) {
             audioQueueRef.current.shift();
          }
          if (audioQueueRef.current.length > 0 && audioQueueRef.current[0].index === chunkIndex) {
             targetChunk = audioQueueRef.current.shift();
          }
       }
       
       if (targetChunk) {
          if (playNextChunkRef.current) {
             playNextChunkRef.current(targetChunk, targetWordIndex);
          }
       } else {
          resumeStateRef.current = { chunkIndex, wordIndex: targetWordIndex };
          if (playNextChunkRef.current) {
             playNextChunkRef.current();
          }
       }
       pausedStateRef.current = null;
    }
  };

  const tryCartesiaTTS"""
content = content.replace("  const tryCartesiaTTS", handlers)

# Inside playNextChunk
play_next_chunk_decl = """      const playNextChunk = async (chunkOverride?: any, wordIndexOverride?: number) => {
        if (currentSessionId !== playSessionIdRef.current) {
          setIsPlaying(false);
          isQueuePlaying = false;
          return;
        }

        let chunk;
        let resumeWordIndex = wordIndexOverride;

        if (chunkOverride) {
            chunk = chunkOverride;
            isQueuePlaying = true;
        } else {
            if (audioQueueRef.current.length === 0) {
              isQueuePlaying = false;
              if (streamEnded && expectedIndex >= totalChunks) {
                if (playedChunks === 0 && failedChunks > 0) {
                  showError('Audio unavailable for this content. Please try again later.');
                }
                setIsPlaying(false);
              }
              return;
            }
            isQueuePlaying = true;
            chunk = audioQueueRef.current.shift();
            
            if (resumeStateRef.current && resumeStateRef.current.chunkIndex === chunk.index) {
                resumeWordIndex = resumeStateRef.current.wordIndex;
                resumeStateRef.current = null;
            }
        }
        
        currentChunkRef.current = chunk;"""

# Replace the old playNextChunk start
old_play_next_chunk = """      const playNextChunk = async () => {
        if (currentSessionId !== playSessionIdRef.current) {
          setIsPlaying(false);
          isQueuePlaying = false;
          return;
        }

        if (audioQueueRef.current.length === 0) {
          isQueuePlaying = false;
          if (streamEnded && expectedIndex >= totalChunks) {
            if (playedChunks === 0 && failedChunks > 0) {
              showError('Audio unavailable for this content. Please try again later.');
            }
            setIsPlaying(false);
          }
          return;
        }

        isQueuePlaying = true;
        const chunk = audioQueueRef.current.shift();"""
content = content.replace(old_play_next_chunk, play_next_chunk_decl)

# set currentTime logic in playNextChunk
audio_setup_old = """        audio.src = chunk.audioUrl;
        audio.playbackRate = playbackRate;
        audio.defaultPlaybackRate = playbackRate;"""
audio_setup_new = """        audio.src = chunk.audioUrl;
        audio.playbackRate = playbackRate;
        audio.defaultPlaybackRate = playbackRate;

        if (resumeWordIndex !== undefined && chunk.timestamps && chunk.timestamps.length > resumeWordIndex) {
           const ts = chunk.timestamps[resumeWordIndex];
           const targetTime = ts.start_time !== undefined ? ts.start_time : ts.start;
           audio.onloadedmetadata = () => {
               audio.currentTime = targetTime;
           }
        }"""
content = content.replace(audio_setup_old, audio_setup_new)

# Assign playNextChunkRef
play_next_chunk_ref_assign = """      // Start reading the stream
      playNextChunkRef.current = playNextChunk;
      (async () => {"""
content = content.replace("      // Start reading the stream\n      (async () => {", play_next_chunk_ref_assign)


ui_old = """    <div className="relative inline-flex items-center gap-1">
      <button
        ref={wrapperRef}
        className={cn(
          "relative p-1.5 bg-black/20 hover:bg-black/40 rounded text-white/50 hover:text-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center touch-manipulation z-10",
          "before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:min-w-[48px] before:min-h-[48px] before:content-['']",
          isPlaying && "text-cyan-400 bg-black/40",
          className
        )}
        title={isPlaying ? "Stop Reading" : "Read Aloud"}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className={cn("animate-spin", iconSizeClasses)} />
        ) : isPlaying ? (
          <div className="flex items-center gap-1">
            <AudioLines className={cn("animate-pulse text-cyan-400", iconSizeClasses)} />
            <Square className="w-2.5 h-2.5 fill-current opacity-70" />
          </div>
        ) : (
          <Volume2 className={iconSizeClasses} />
        )}
      </button>"""

ui_new = """    <div className="relative inline-flex items-center gap-1" ref={wrapperRef}>
      {isPlaying ? (
          <div className={cn("flex items-center rounded bg-black/40 text-cyan-400 z-10 min-h-[48px]", className)}>
             {isLoading ? (
                <button className="p-1.5 touch-manipulation min-w-[48px] flex items-center justify-center" disabled>
                   <Loader2 className={cn("animate-spin", iconSizeClasses)} />
                </button>
             ) : (
                <>
                    <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); isPaused ? handleResume() : handlePause(); }}
                        className="p-1.5 touch-manipulation min-w-[48px] flex items-center justify-center hover:bg-black/20 hover:text-cyan-300 transition-colors rounded-l"
                        title={isPaused ? "Resume" : "Pause"}
                    >
                        {isPaused ? <Play className={iconSizeClasses} /> : <Pause className={iconSizeClasses} />}
                    </button>
                    <div className="w-[1px] h-6 bg-white/10" />
                    <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); stopPlaying(); }}
                        className="p-1.5 touch-manipulation min-w-[48px] flex items-center justify-center hover:bg-black/20 hover:text-red-400 transition-colors rounded-r"
                        title="Stop"
                    >
                        <Square className="w-3.5 h-3.5 fill-current opacity-70" />
                    </button>
                </>
             )}
          </div>
      ) : (
         <button
            ref={actionButtonRef}
            onClick={(e) => {
               // Prevent default to prevent mobile issues? The effect already does it.
               // We still keep the triggerSpeech call in onClick as fallback
            }}
            className={cn(
              "relative p-1.5 bg-black/20 hover:bg-black/40 rounded text-white/50 hover:text-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center touch-manipulation z-10 min-w-[48px] min-h-[48px]",
              className
            )}
            title="Read Aloud"
            disabled={isLoading}
         >
            {isLoading ? <Loader2 className={cn("animate-spin", iconSizeClasses)} /> : <Volume2 className={iconSizeClasses} />}
         </button>
      )}"""

content = content.replace(ui_old, ui_new)

with open('src/components/ReadAloudButton.tsx', 'w') as f:
    f.write(content)

