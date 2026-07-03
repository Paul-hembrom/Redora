const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');
code = code.replace(/imageUrl\.match\(\/data:\(\[a-zA-Z0-9\]\+\/\[a-zA-Z0-9-\.\+\]\+\)\.\*,\.\*\/\)/, "imageUrl.match(/data:([a-zA-Z0-9]+\\\\/[a-zA-Z0-9-.+]+).*,.*/)");
fs.writeFileSync('src/lib/gemini.ts', code);
