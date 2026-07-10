import fs from 'fs';

let content = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf-8');

const regex = /const playQueue = async \(chunks, index\) => \{[\s\S]*?playQueue\(data\.chunks, 0\);/;

const newLogic = `
  const playQueue = async (chunks) => {
    if (stopIntentRef.current || chunks.length === 0) {
      setIsPlaying(false);
      return;
    }
    const currentChunk = chunks.shift();
    const audio = new Audio(currentChunk.audioUrl);
    audioRef.current = audio;
    
    // Preload next chunk if available
    let nextAudio = null;
    if (chunks.length > 0) {
      nextAudio = new Audio(chunks[0].audioUrl);
      nextAudio.preload = 'auto';
    }

    audio.onended = () => {
      if (!stopIntentRef.current) {
        playQueue(chunks);
      }
    };
    audio.onerror = () => {
      setIsPlaying(false);
      logError('ElevenLabs chunk audio element threw a playback error.');
      speakWithBrowser();
    };

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      setIsPlaying(false);
      logError('ElevenLabs chunk playback failed:', err);
    }
  };

  const tryElevenLabsTTS = async () => {
    logInfo('Triggered: Attempting ElevenLabs TTS API call...');
    try {
      setIsLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/tts/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) {
        throw new Error(\`API returned \${res.status}\`);
      }
      const data = await res.json();
      if (!data.chunks || data.chunks.length === 0) throw new Error('No audio chunks returned');
      
      setIsLoading(false);
      stopIntentRef.current = false;
      playQueue(data.chunks);
`;

content = content.replace(regex, newLogic.trim());

fs.writeFileSync('src/components/ReadAloudButton.tsx', content);
console.log('done');
