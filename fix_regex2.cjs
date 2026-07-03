const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');
code = code.replace(/imageUrl\.match\(.*\|\| 'image\/jpeg';/, "imageUrl.substring(imageUrl.indexOf(':') + 1, imageUrl.indexOf(';')) || 'image/jpeg';");
fs.writeFileSync('src/lib/gemini.ts', code);
