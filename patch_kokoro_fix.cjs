const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldStr = `  } else if (mappedTimestamps.length > 0) {
      // Scale native timestamps if any were returned
      const scaleFactor = rawDuration > 0 ? playbackDuration / rawDuration : 1;
      
  }

  // To prevent the next lines from breaking
  mappedTimestamps = mappedTimestamps.map((t: any) => ({
    ...t,
    start: +(t.start * scaleFactor).toFixed(4),
    end: +(t.end * scaleFactor).toFixed(4)
  }));`;

const newStr = `  } else if (mappedTimestamps.length > 0) {
      // Scale native timestamps if any were returned
      const scaleFactor = rawDuration > 0 ? playbackDuration / rawDuration : 1;
      mappedTimestamps = mappedTimestamps.map((t: any) => ({
        ...t,
        start: +(t.start * scaleFactor).toFixed(4),
        end: +(t.end * scaleFactor).toFixed(4)
      }));
  }`;

content = content.replace(oldStr, newStr);

fs.writeFileSync('server.ts', content);
