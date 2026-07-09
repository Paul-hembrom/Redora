const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf-8');
const idx = content.indexOf("app.get('/api/curriculum'");
console.log("Index:", idx);
if (idx > -1) {
  console.log(content.substring(idx - 100, idx + 100));
}
