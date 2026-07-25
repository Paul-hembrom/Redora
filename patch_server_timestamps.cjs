const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const regex = /\} else if \(mappedTimestamps\.length > 0\) \{[\s\S]*?\}[\s\S]*?console\.log\('\[Kokoro\] Returning audioUrl \(length\)'/m;

const replacement = `} else if (mappedTimestamps.length > 0) {
      const scaleFactor = playbackDuration / rawDuration;
      mappedTimestamps = mappedTimestamps.map((t: any) => ({
        word: t.word,
        start: +(t.start * scaleFactor).toFixed(4),
        end:   +(t.end   * scaleFactor).toFixed(4)
      }));
  }

  console.log('[Kokoro] Returning audioUrl (length)'`;

content = content.replace(regex, replacement);

fs.writeFileSync('server.ts', content);
console.log("Patched server.ts successfully");
