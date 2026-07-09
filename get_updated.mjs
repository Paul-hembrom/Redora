import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `app.post('/api/curriculum/generate', authenticate, async (req: any, res) => {`;
const idx = content.indexOf(targetStr);
const substr = content.substring(idx, idx + 800);
console.log(substr);
