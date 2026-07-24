const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "console.log('[Kokoro] First timestamp:', JSON.stringify(mappedTimestamps[0]));",
  "console.log('[Kokoro] First timestamp after mapping:', JSON.stringify(mappedTimestamps[0]));"
);

fs.writeFileSync('server.ts', code);
console.log("Patched Kokoro log");
