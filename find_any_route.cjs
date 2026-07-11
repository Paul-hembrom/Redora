const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf-8');
const matches = [...content.matchAll(/app\.(get|post|put|delete)\('([^']+)'/g)];
matches.forEach(m => console.log(m[2]));
