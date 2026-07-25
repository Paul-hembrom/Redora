const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const returnStatement = `  return {
    audioUrl,
    timestamps: mappedTimestamps,
    rawDuration,
    playbackDuration
  };`;

const logs = `  console.log('[Kokoro] RETURNING – rawDuration:', rawDuration?.toFixed(2), 'playbackDuration:', playbackDuration?.toFixed(2));
  if (mappedTimestamps.length > 0) {
    console.log('[Kokoro] First timestamp:', JSON.stringify(mappedTimestamps[0]));
    console.log('[Kokoro] Last timestamp:', JSON.stringify(mappedTimestamps[mappedTimestamps.length - 1]));
  }
  return {
    audioUrl,
    timestamps: mappedTimestamps,
    rawDuration,
    playbackDuration
  };`;

content = content.replace(returnStatement, logs);
fs.writeFileSync('server.ts', content);
