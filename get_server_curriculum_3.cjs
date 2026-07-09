const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf-8');
console.log("File length:", content.length);
console.log("First 500 chars:\n", content.substring(0, 500));
console.log("Last 500 chars:\n", content.substring(content.length - 500));
