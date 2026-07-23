const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  "voice: { mode: 'id', id: 'a0e99841-438c-4a64-b679-ae501e7d6091' }",
  "voice: { mode: 'id', id: '62ae83ad-4f6a-430b-af41-a9bede9286ca' }"
);
fs.writeFileSync('server.ts', code);
console.log("Updated Cartesia voice ID in server.ts");
