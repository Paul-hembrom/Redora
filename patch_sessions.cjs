const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// Replace stopIntentRef with playSessionIdRef
content = content.replace(/const stopIntentRef = useRef\(false\);/, "const playSessionIdRef = useRef<number>(0);");

// Update stopPlaying
const regexStop = /  const stopPlaying = \(\) => \{[\s\S]*?setIsLoading\(false\);\n  \};/;
const replStop = `  const stopPlaying = () => {
    playSessionIdRef.current += 1;
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
content = content.replace(regexStop, replStop);

// Update tryCartesiaTTS
content = content.replace(/const tryCartesiaTTS = async \(\) => \{/, `const tryCartesiaTTS = async () => {\n    const currentSessionId = playSessionIdRef.current;`);
content = content.replace(/stopIntentRef\.current/g, "currentSessionId !== playSessionIdRef.current");

// Update triggerSpeech
content = content.replace(/currentSessionId !== playSessionIdRef\.current = false;/g, "playSessionIdRef.current += 1;"); // oops, from replace above
content = content.replace(/stopIntentRef\.current = false;/g, "playSessionIdRef.current += 1;"); // this won't work if already replaced. 

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Patched session IDs");
