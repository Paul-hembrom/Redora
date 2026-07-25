const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const regex1 = /let mappedTimestamps = data\.timestamps\.map\(\(t: any\) => \(\{\s*word: t\.word,\s*start: t\.start_time !== undefined \? t\.start_time : t\.start,\s*end: t\.end_time !== undefined \? t\.end_time : t\.end\s*\}\)\);/m;

const repl1 = `let mappedTimestamps = data.timestamps.map((t: any) => ({
    word: t.word,
    start: t.start !== undefined ? t.start : t.start_time,
    end: t.end !== undefined ? t.end : t.end_time
  }));`;

content = content.replace(regex1, repl1);

const regex2 = /const rawDuration = Math\.max\(0, totalFrames \/ sampleRate\);\s*const playbackDuration = rawDuration \/ PLAYBACK_RATE;/m;
const repl2 = `const calculatedRawDuration = Math.max(0, totalFrames / sampleRate);
  const rawDuration = data.playbackDuration !== undefined ? data.playbackDuration : calculatedRawDuration;
  const playbackDuration = rawDuration / PLAYBACK_RATE;`;

content = content.replace(regex2, repl2);

fs.writeFileSync('server.ts', content);
console.log("Patched successfully");
