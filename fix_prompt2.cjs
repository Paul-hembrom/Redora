const fs = require('fs');
let content = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

content = content.replace(
  'Return a JSON object of the form {"scenes": [ ... ]} containing 6 to 10 scene objects.`;',
  'Return a JSON object of the form {"scenes": [ ... ]} containing 6 to 10 scene objects.\nOutput only that JSON object, with no markdown formatting.`;'
);

fs.writeFileSync('server/videoPipeline.ts', content);
console.log("Fixed prompt end");
