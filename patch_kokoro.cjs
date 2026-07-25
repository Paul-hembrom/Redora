const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const targetFunctionStart = content.indexOf('async function synthesizeKokoroSpeech');
const targetFunctionEnd = content.indexOf('app.post(\'/api/tts/cartesia\'');

if (targetFunctionStart !== -1 && targetFunctionEnd !== -1) {
    let functionBody = content.substring(targetFunctionStart, targetFunctionEnd);
    
    // Replace the synthetic timestamp block
    const oldBlockRegex = /if \(mappedTimestamps\.length === 0 && data\.audio_base64\.length > 300\) \{[\s\S]*?const scaleFactor = rawDuration > 0 \? playbackDuration \/ rawDuration : 1;/;
    
    const newBlock = `if (mappedTimestamps.length === 0 && data.audio_base64.length > 300) {
    const words = cleanText
      .split(/\\s+/)
      .map(w => w.replace(/[^a-zA-Z]/g, ''))
      .filter(w => w.length > 0);
      
    if (words.length > 0) {
      const totalChars = words.reduce((sum, w) => sum + w.length, 0);
      let currentTime = 0;
      
      mappedTimestamps = words.map((word) => {
        const wordDuration = (word.length / totalChars) * playbackDuration;
        const timestamp = {
          word,
          start: currentTime,
          end: currentTime + wordDuration
        };
        currentTime += wordDuration;
        return timestamp;
      });
      console.log(\`[Kokoro] Raw duration: \${rawDuration.toFixed(2)}s, Playback duration: \${playbackDuration.toFixed(2)}s, Words: \${words.length}\`);
    }
  } else if (mappedTimestamps.length > 0) {
      // Scale native timestamps if any were returned
      const scaleFactor = rawDuration > 0 ? playbackDuration / rawDuration : 1;
      mappedTimestamps = mappedTimestamps.map((t: any) => ({
        ...t,
        start: +(t.start * scaleFactor).toFixed(4),
        end: +(t.end * scaleFactor).toFixed(4)
      }));
  }

  // To prevent the next lines from breaking`;

    functionBody = functionBody.replace(oldBlockRegex, newBlock);
    
    // Clean up any remaining scaleFactor mapping outside if it exists
    const extraMappingRegex = /mappedTimestamps = mappedTimestamps\.map\(\(t: any\) => \(\{[\s\S]*?\}\)\);/;
    functionBody = functionBody.replace(extraMappingRegex, '');
    
    content = content.substring(0, targetFunctionStart) + functionBody + content.substring(targetFunctionEnd);
    fs.writeFileSync('server.ts', content);
    console.log("Patched successfully");
} else {
    console.log("Could not find function bounds");
}
