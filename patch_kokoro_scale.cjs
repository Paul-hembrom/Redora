const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const targetStr = `  const audioUrl = \`data:audio/wav;base64,\${data.audio_base64}\`;

  if (mappedTimestamps.length === 0 && data.audio_base64.length > 300) {
    const audioBuffer = Buffer.from(data.audio_base64, 'base64');
    const audioBytes = audioBuffer.length;
    const PLAYBACK_RATE = 0.8;
    let numChannels = 1;
    let sampleRate = 24000;
    let bitsPerSample = 16;
    if (audioBytes > 44) {
      numChannels = audioBuffer.readUInt16LE(22);
      sampleRate = audioBuffer.readUInt32LE(24);
      bitsPerSample = audioBuffer.readUInt16LE(34);
    }
    const dataSize = audioBytes - 44;
    const bytesPerSample = bitsPerSample / 8;
    const bytesPerFrame = numChannels * bytesPerSample;
    const totalFrames = dataSize / bytesPerFrame;
    const rawDuration = Math.max(0, totalFrames / sampleRate);
    const playbackDuration = rawDuration / PLAYBACK_RATE;
    const words = cleanText.split(/\\s+/).filter(w => w.length > 0);
    
    const cleanedWords = words
      .map(w => w.replace(/[^a-zA-Z]/g, ''))
      .filter(w => w.length > 0);
      
    const speakableWords = cleanedWords.filter(w => 
      w.length > 1 || w === 'a' || w === 'i' || w === 'A' || w === 'I'
    );
      
    if (speakableWords.length > 0) {
      const totalChars = speakableWords.reduce((sum, w) => sum + w.length, 0);
      let currentTime = 0;
      
      mappedTimestamps = speakableWords.map((word) => {
        const wordDuration = (word.length / totalChars) * playbackDuration;
        const timestamp = {
          word,
          start: currentTime,
          end: currentTime + wordDuration
        };
        currentTime += wordDuration;
        return timestamp;
      });
      console.log(\`[Kokoro] Raw duration: \${rawDuration.toFixed(2)}s, Playback duration: \${playbackDuration.toFixed(2)}s, Speakable Words: \${speakableWords.length}\`);
    } else if (words.length > 0) {
      const avgDuration = playbackDuration / words.length;
      mappedTimestamps = words.map((word, idx) => ({
        word,
        start: idx * avgDuration,
        end: (idx + 1) * avgDuration
      }));
    }
  }

  console.log('[Kokoro] Returning audioUrl (length)', audioUrl.length, 'timestamps count:', mappedTimestamps.length);
  if (mappedTimestamps.length > 0) {
    console.log('[Kokoro] First timestamp after mapping:', JSON.stringify(mappedTimestamps[0]));
  }

  return {
    audioUrl,
    timestamps: mappedTimestamps
  };`;

const newStr = `  const audioUrl = \`data:audio/wav;base64,\${data.audio_base64}\`;

  const audioBuffer = Buffer.from(data.audio_base64, 'base64');
  const audioBytes = audioBuffer.length;
  const PLAYBACK_RATE = 0.8;
  let numChannels = 1;
  let sampleRate = 24000;
  let bitsPerSample = 16;
  if (audioBytes > 44) {
    numChannels = audioBuffer.readUInt16LE(22);
    sampleRate = audioBuffer.readUInt32LE(24);
    bitsPerSample = audioBuffer.readUInt16LE(34);
  }
  const dataSize = audioBytes - 44;
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = numChannels * bytesPerSample;
  const totalFrames = dataSize / bytesPerFrame;
  const rawDuration = Math.max(0, totalFrames / sampleRate);
  const playbackDuration = rawDuration / PLAYBACK_RATE;

  if (mappedTimestamps.length === 0 && data.audio_base64.length > 300) {
    const words = cleanText.split(/\\s+/).filter(w => w.length > 0);
    
    const cleanedWords = words
      .map(w => w.replace(/[^a-zA-Z]/g, ''))
      .filter(w => w.length > 0);
      
    const speakableWords = cleanedWords.filter(w => 
      w.length > 1 || w === 'a' || w === 'i' || w === 'A' || w === 'I'
    );
      
    if (speakableWords.length > 0) {
      const totalChars = speakableWords.reduce((sum, w) => sum + w.length, 0);
      let currentTime = 0;
      
      mappedTimestamps = speakableWords.map((word) => {
        const wordDuration = (word.length / totalChars) * playbackDuration;
        const timestamp = {
          word,
          start: currentTime,
          end: currentTime + wordDuration
        };
        currentTime += wordDuration;
        return timestamp;
      });
      console.log(\`[Kokoro] Raw duration: \${rawDuration.toFixed(2)}s, Playback duration: \${playbackDuration.toFixed(2)}s, Speakable Words: \${speakableWords.length}\`);
    } else if (words.length > 0) {
      const avgDuration = playbackDuration / words.length;
      mappedTimestamps = words.map((word, idx) => ({
        word,
        start: idx * avgDuration,
        end: (idx + 1) * avgDuration
      }));
    }
  }

  // Scale timestamps using the playback ratio
  if (rawDuration > 0) {
    const scaleFactor = playbackDuration / rawDuration;
    mappedTimestamps = mappedTimestamps.map((t: any) => ({
      ...t,
      start: +(t.start * scaleFactor).toFixed(4),
      end: +(t.end * scaleFactor).toFixed(4)
    }));
  }

  console.log('[Kokoro] Returning audioUrl (length)', audioUrl.length, 'timestamps count:', mappedTimestamps.length);
  if (mappedTimestamps.length > 0) {
    console.log('[Kokoro] First timestamp after mapping:', JSON.stringify(mappedTimestamps[0]));
  }

  return {
    audioUrl,
    timestamps: mappedTimestamps
  };`;

if (!content.includes(targetStr)) {
  console.log("Could not find target string in server.ts");
} else {
  content = content.replace(targetStr, newStr);
  fs.writeFileSync('server.ts', content);
  console.log("Patched server.ts successfully");
}
