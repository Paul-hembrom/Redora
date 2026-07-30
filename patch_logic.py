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
refs_decl = """  const buttonRef = useRef<HTMLButtonElement>(null);
  const pausedStateRef = useRef<{ chunkIndex: number, wordIndex: number, currentTime: number } | null>(null);
  const resumeStateRef = useRef<{ chunkIndex: number, wordIndex: number } | null>(null);
  const currentChunkRef = useRef<any>(null);
  const playNextChunkRef = useRef<((chunkOverride?: any, wordIndexOverride?: number) => void) | null>(null);
  const audioQueueRef = useRef<any[]>([]);"""
content = re.sub(r'  const buttonRef = useRef<HTMLButtonElement>\(null\);\n  const audioQueueRef = useRef<any\[\]>\(\[\]\);', refs_decl, content)


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

with open('src/components/ReadAloudButton.tsx', 'w') as f:
    f.write(content)
