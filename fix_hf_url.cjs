const fs = require('fs');
let content = fs.readFileSync('server/videoPipeline.ts', 'utf-8');
content = content.replace(
  /"https:\/\/paulhemb-redora.hf.space\/v1\/speech"/g, 
  '`${process.env.HF_SPACE_URL}/v1/speech`'
);
fs.writeFileSync('server/videoPipeline.ts', content);
console.log("Fixed HF_SPACE_URL");
