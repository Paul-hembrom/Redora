const fs = require('fs');
let content = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

content = content.replace(
  'Return a JSON array of 6 to 10 scenes.',
  'Return 6 to 10 scenes.'
);

fs.writeFileSync('server/videoPipeline.ts', content);
console.log("Fixed prompt");
