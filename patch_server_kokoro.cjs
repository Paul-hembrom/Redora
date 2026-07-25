const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const regex = /let mappedTimestamps = data\.timestamps\.map\(\(t: any\) => \(\{\s*word: t\.word,\s*start: t\.start_time,\s*end: t\.end_time\s*\}\)\);/m;

const replacement = `let mappedTimestamps = data.timestamps.map((t: any) => ({
    word: t.word,
    start: t.start_time !== undefined ? t.start_time : t.start,
    end: t.end_time !== undefined ? t.end_time : t.end
  }));`;

content = content.replace(regex, replacement);

fs.writeFileSync('server.ts', content);
console.log("Patched server.ts successfully");
