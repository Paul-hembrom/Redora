const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

code = code.replace(
  "generateSearchQueries } from '../lib/gemini'",
  "generateSearchQueries, generateNewsSearchQuery } from '../lib/gemini'"
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Updated gemini imports");
