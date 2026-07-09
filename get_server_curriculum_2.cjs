const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf-8');
const idx = content.indexOf("app.post('/api/curriculum/generate'");
console.log("POST Index:", idx);
