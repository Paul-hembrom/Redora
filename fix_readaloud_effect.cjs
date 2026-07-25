const fs = require('fs');
let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

// Insert after `useEffect(() => { ... }, [text, isPlaying, isLoading, voicesAvailable]);`
const insertionPoint = `  }, [text, isPlaying, isLoading, voicesAvailable]);`;
const newEffect = `  }, [text, isPlaying, isLoading, voicesAvailable]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.defaultPlaybackRate = playbackRate;
    }
  }, [playbackRate]);`;

content = content.replace(insertionPoint, newEffect);

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log("Added playbackRate useEffect in ReadAloudButton");
