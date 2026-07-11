import fs from 'fs';

let content = fs.readFileSync('src/components/ChatArea.tsx', 'utf-8');

content = content.replace(
  /\{msg\.images && msg\.images\.length > 0 && \(/g,
  '{Array.isArray(msg.images) && msg.images.length > 0 && ('
);

fs.writeFileSync('src/components/ChatArea.tsx', content);
console.log('done');
