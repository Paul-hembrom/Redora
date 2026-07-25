const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// 1. Add new refs
const refInsert = `  const buttonRef = useRef<HTMLButtonElement>(null);
  const audioQueueRef = useRef<any[]>([]);
  const chunksMapRef = useRef<Map<number, any>>(new Map());
  const animationFrameIdRef = useRef<number | null>(null);`;
content = content.replace(/  const buttonRef = useRef<HTMLButtonElement>\(null\);/, refInsert);

// 2. Global cleanup function
const cleanupFunc = `  const clearAllHighlights = () => {
    document.querySelectorAll('.tts-word').forEach((el) => {
      const domSpan = el as HTMLElement;
      domSpan.style.background = '';
      domSpan.style.webkitBackgroundClip = '';
      domSpan.style.backgroundClip = '';
      domSpan.style.color = '';
      domSpan.classList.remove('bg-amber-400/70');
    });
  };

  const stopPlaying = () => {
    stopIntentRef.current = true;
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    clearAllHighlights();
    
    audioQueueRef.current = [];
    chunksMapRef.current.clear();
    
    const highlightOverlay = document.getElementById('tts-highlight-overlay');
    if (highlightOverlay) highlightOverlay.style.opacity = '0';
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsLoading(false);
  };`;
content = content.replace(/  const stopPlaying = \(\) => \{[\s\S]*?setIsLoading\(false\);\n  \};/, cleanupFunc);

// 3. Reset all state on text/idPrefix change
const resetEffect = `  useEffect(() => {
    return () => stopPlaying();
  }, [text, idPrefix]);`;
content = content.replace(/  useEffect\(\(\) => \{\n    return \(\) => stopPlaying\(\);\n  \}, \[\]\);/, resetEffect);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Patched ReadAloudButton refs successfully");
