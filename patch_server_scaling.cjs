const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const scalingStr = `  } else if (mappedTimestamps.length > 0) {
      // Scale native timestamps if any were returned
      const scaleFactor = rawDuration > 0 ? playbackDuration / rawDuration : 1;
      mappedTimestamps = mappedTimestamps.map((t: any) => ({
        ...t,
        start: +(t.start * scaleFactor).toFixed(4),
        end: +(t.end * scaleFactor).toFixed(4)
      }));
  }`;
content = content.replace(scalingStr, `  } else if (mappedTimestamps.length > 0) {
      // Do not scale in backend; let frontend handle it
  }`);

const returnStr = `  return {
    audioUrl,
    timestamps: mappedTimestamps
  };`;
const newReturnStr = `  return {
    audioUrl,
    timestamps: mappedTimestamps,
    rawDuration,
    playbackDuration
  };`;
content = content.replace(returnStr, newReturnStr);

const chunkJsonStr = `            res.write(JSON.stringify({
                index: i,
                domIndex: chunk.domIndex,
                text: chunk.text,
                audioUrl: kokoroResult.audioUrl,
                timestamps: kokoroResult.timestamps
            }) + '\\n');`;
const newChunkJsonStr = `            res.write(JSON.stringify({
                index: i,
                domIndex: chunk.domIndex,
                text: chunk.text,
                audioUrl: kokoroResult.audioUrl,
                timestamps: kokoroResult.timestamps,
                rawDuration: kokoroResult.rawDuration,
                playbackDuration: kokoroResult.playbackDuration
            }) + '\\n');`;
content = content.replace(chunkJsonStr, newChunkJsonStr);

fs.writeFileSync('server.ts', content);
console.log("Patched server.ts successfully");
