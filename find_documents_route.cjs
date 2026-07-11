const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf-8');
let idx = content.indexOf('app.get(\'/api/documents\'');
if (idx === -1) idx = content.indexOf('app.get("/api/documents"');
if (idx > -1) {
  console.log(content.substring(idx - 100, idx + 1000));
} else {
  console.log('Not found');
}
