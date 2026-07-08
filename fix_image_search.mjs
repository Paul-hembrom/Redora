import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

// Update retry attempts from 5 to 2
content = content.replace(
  'attempts: 5',
  'attempts: 2'
);

// Update model from gemini-3.1-pro-preview to gemini-2.5-flash
content = content.replace(
  "model: 'gemini-3.1-pro-preview',",
  "model: 'gemini-2.5-flash',"
);

fs.writeFileSync('server.ts', content);
