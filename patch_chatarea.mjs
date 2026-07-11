import fs from 'fs';
let content = fs.readFileSync('src/components/ChatArea.tsx', 'utf-8');
content = content.replace(/\{msg\.images\.map\(\(img, iIdx\) => \(/g, "{(Array.isArray(msg.images) ? msg.images : []).map((img, iIdx) => (");
fs.writeFileSync('src/components/ChatArea.tsx', content);
